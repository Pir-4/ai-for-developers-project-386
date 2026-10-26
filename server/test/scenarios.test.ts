// Обязательный сценарный набор: вся история целиком через HTTP-границу
// сервера (app.inject(), фиксированные часы, :memory: БД) — итоговый критерий
// качества, отдельный от точечных тестов на каждый эндпоинт в соседних файлах.
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { bookingsUrl, bookingsUrlOf, slotsUrl, slotsUrlOf } from "./event-type-urls.js";

const availabilityUrl = (date: string) => `/api/availability/${date}`;
const meetingsUrl = "/api/meetings";
const typesUrl = "/api/event-types";

const now = new Date("2024-01-10T09:47:00.000Z");
const day = "2024-01-11";
const iso = (time: string) => `${day}T${time}:00.000Z`;

const guest = { guestName: "Гость", guestEmail: "guest@example.com" };

// Рабочий день с обедом: 11:00–13:00 и 14:00–16:00.
const workday = [
  { start: iso("11:00"), end: iso("13:00") },
  { start: iso("14:00"), end: iso("16:00") },
];

const build = () => buildApp({ dbPath: ":memory:", clock: () => now });
const at = (slots: { start: string }[]) => slots.map((s) => s.start.slice(11, 16));

async function openWorkday(app: Awaited<ReturnType<typeof build>>) {
  await app.inject({
    method: "PUT",
    url: availabilityUrl(day),
    payload: { intervals: workday },
  });
}

describe("Полный сценарий: владелец → типы встреч → доступность → лестница → бронь → встречи → защита дня", () => {
  it("0. владелец один и задан заранее: гость видит его профиль без входа", async () => {
    const app = await buildApp({
      dbPath: ":memory:",
      clock: () => now,
      owner: { name: "Мария Петрова", email: "maria@example.com" },
    });

    const owner = await app.inject({ method: "GET", url: "/api/owner" });
    expect(owner.json()).toEqual({ name: "Мария Петрова", email: "maria@example.com" });

    await app.close();
  });

  it("1. владелец заводит типы встреч своей длительности — гость видит их каталог", async () => {
    const app = await build();
    for (const body of [
      { name: "Знакомство", description: "Короткий первый созвон", durationMinutes: 30 },
      { name: "Консультация", description: "Разбор задачи", durationMinutes: 60 },
    ]) {
      expect((await app.inject({ method: "POST", url: typesUrl, payload: body })).statusCode)
        .toBe(201);
    }

    const catalog = (await app.inject({ method: "GET", url: typesUrl })).json();
    expect(catalog.map((t: { name: string; durationMinutes: number }) => [t.name, t.durationMinutes]))
      .toEqual([["Знакомство", 30], ["Консультация", 60]]);

    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("11:00"), end: iso("12:30") }] },
    });
    // Начала — по 30-минутной сетке, но часовая встреча должна целиком влезть в интервал.
    const short = (await app.inject({ method: "GET", url: slotsUrlOf(catalog[0].id) })).json();
    expect(at(short)).toEqual(["11:00", "11:30", "12:00"]);
    const long = (await app.inject({ method: "GET", url: slotsUrlOf(catalog[1].id) })).json();
    expect(at(long)).toEqual(["11:00", "11:30"]);
    expect(long[0].end).toBe(iso("12:00"));

    await app.close();
  });

  it("2. владелец объявляет два интервала — они возвращаются ему целиком", async () => {
    const app = await build();

    const saved = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });
    expect(saved.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/availability" });
    expect(list.json()).toEqual([{ date: day, intervals: workday }]);

    await app.close();
  });

  it("3. лестница гостя идёт по 30-минутной сетке и рвётся на обеде", async () => {
    const app = await build();
    await openWorkday(app);

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    expect(at(slots)).toEqual([
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
    ]);
    expect(slots.every((slot: { status: string }) => slot.status === "free")).toBe(true);

    await app.close();
  });

  it("4. гость бронирует ячейку в середине — соседние остаются свободными", async () => {
    const app = await build();
    await openWorkday(app);

    const booked = await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("14:30") },
    });
    expect(booked.statusCode).toBe(201);
    expect(booked.json().end).toBe(iso("15:00"));

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    const byTime = Object.fromEntries(
      slots.map((slot: { start: string; status: string }) => [
        slot.start.slice(11, 16),
        slot.status,
      ]),
    );
    expect(byTime).toMatchObject({
      "14:00": "free",
      "14:30": "busy",
      "15:00": "free",
    });

    await app.close();
  });

  it("5. бронь одного типа встречи занимает пересекающиеся слоты у других типов", async () => {
    const app = await build();
    await openWorkday(app);
    const [long, short] = await Promise.all(
      [
        { name: "Консультация", durationMinutes: 60 },
        { name: "Знакомство", durationMinutes: 30 },
      ].map(async (body) =>
        (
          await app.inject({
            method: "POST",
            url: typesUrl,
            payload: { ...body, description: "Созвон" },
          })
        ).json().id as number,
      ),
    );

    // Часовая бронь 14:30–15:30 закрывает у 30-минутного типа и 14:30, и 15:00.
    const booked = await app.inject({
      method: "POST",
      url: bookingsUrlOf(long!),
      payload: { ...guest, start: iso("14:30") },
    });
    expect(booked.json()).toMatchObject({ end: iso("15:30"), durationMinutes: 60 });

    const slots = (await app.inject({ method: "GET", url: slotsUrlOf(short!) })).json();
    const busy = slots.filter((slot: { status: string }) => slot.status === "busy");
    expect(at(busy)).toEqual(["14:30", "15:00"]);

    // А у самого часового типа — все ячейки, задевающие 14:30–15:30.
    const own = (await app.inject({ method: "GET", url: slotsUrlOf(long!) })).json();
    const ownBusy = own.filter((slot: { status: string }) => slot.status === "busy");
    expect(at(ownBusy)).toEqual(["14:00", "14:30", "15:00"]);

    for (const start of ["14:30", "15:00"]) {
      const clash = await app.inject({
        method: "POST",
        url: bookingsUrlOf(short!),
        payload: { ...guest, guestName: "Другой гость", start: iso(start) },
      });
      expect(clash.statusCode).toBe(409);
    }

    await app.close();
  });

  it("6. владелец видит встречу в своём списке", async () => {
    const app = await build();
    await openWorkday(app);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("14:30") },
    });

    const meetings = (await app.inject({ method: "GET", url: meetingsUrl })).json();
    expect(meetings).toEqual([
      {
        id: expect.any(Number),
        eventTypeId: expect.any(Number),
        eventTypeName: "Встреча",
        start: iso("14:30"),
        end: iso("15:00"),
        durationMinutes: 30,
        guestName: "Гость",
        guestEmail: "guest@example.com",
      },
    ]);

    await app.close();
  });

  it("7. второй гость на ту же ячейку получает 409", async () => {
    const app = await build();
    await openWorkday(app);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("14:30") },
    });

    const second = await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: {
        guestName: "Второй",
        guestEmail: "second@example.com",
        start: iso("14:30"),
      },
    });
    expect(second.statusCode).toBe(409);

    await app.close();
  });

  it("8. сужение дня под бронью — 409 с перечнем встреч; расширение проходит", async () => {
    const app = await build();
    await openWorkday(app);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("14:30") },
    });

    const narrowed = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("11:00"), end: iso("13:00") }] },
    });
    expect(narrowed.statusCode).toBe(409);
    expect(narrowed.json().meetings).toEqual([
      { start: iso("14:30"), end: iso("15:00"), guestName: "Гость" },
    ]);

    const widened = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("09:00"), end: iso("20:00") }] },
    });
    expect(widened.statusCode).toBe(200);

    await app.close();
  });

  it("9. края: прошедшие ячейки не предлагаются, окно — ровно 14 дней", async () => {
    const app = await buildApp({
      dbPath: ":memory:",
      clock: () => new Date(`${day}T15:00:00.000Z`),
    });
    await openWorkday(app);

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    expect(at(slots)).toEqual(["15:00", "15:30"]);

    // Сегодня 2024-01-11: последний день окна — 2024-01-24, следующий уже вне.
    const lastDay = await app.inject({
      method: "PUT",
      url: availabilityUrl("2024-01-24"),
      payload: { intervals: [] },
    });
    expect(lastDay.statusCode).toBe(200);

    const tooFar = await app.inject({
      method: "PUT",
      url: availabilityUrl("2024-01-25"),
      payload: { intervals: [] },
    });
    expect(tooFar.statusCode).toBe(422);

    await app.close();
  });

  it("10. формы ошибок: 422 на кривой запрос, 404 без доступности", async () => {
    const app = await build();

    const noAvailability = await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("11:00") },
    });
    expect(noAvailability.statusCode).toBe(404);
    expect(noAvailability.json()).toHaveProperty("message");

    await openWorkday(app);

    const badStart = await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("11:15") },
    });
    expect(badStart.statusCode).toBe(422);
    expect(badStart.json().errors[0]).toMatchObject({ path: "start" });

    await app.close();
  });
});
