// Обязательный сценарный набор (спека #40, "Testing Decisions"): вся история
// целиком через HTTP-границу сервера (app.inject(), фиксированные часы,
// :memory: БД) — итоговый критерий качества, отдельный от точечных тестов на
// каждый эндпоинт в соседних файлах.
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { eventTypeUrls } from "./event-type-urls.js";

const owner = "owner@example.com";
const enc = encodeURIComponent(owner);
const availabilityUrl = (date: string) => `/api/owners/${enc}/availability/${date}`;
const { slotsUrl, bookingsUrl } = eventTypeUrls(owner);
const meetingsUrl = `/api/owners/${enc}/meetings`;

const now = new Date("2024-01-10T09:47:00.000Z");
const day = "2024-01-11";
const iso = (time: string) => `${day}T${time}:00.000Z`;

const guest = { guestName: "Гость", guestEmail: "guest@example.com" };

// Рабочий день с обедом: 11:00–13:00 и 14:00–18:00.
const workday = [
  { start: iso("11:00"), end: iso("13:00") },
  { start: iso("14:00"), end: iso("18:00") },
];

const build = () => buildApp({ dbPath: ":memory:", clock: () => now });
const at = (slots: { start: string }[]) => slots.map((s) => s.start.slice(11, 16));

describe("Полный сценарий: тип встречи → доступность → лестница → бронь → встречи → защита дня", () => {
  it("0. владелец заводит типы встреч — гость видит их каталог и лестницу их длительности", async () => {
    const app = await build();
    const typesUrl = `/api/owners/${enc}/event-types`;
    for (const body of [
      { name: "Знакомство", description: "Короткий первый созвон", durationMinutes: 30 },
      { name: "Консультация", description: "Разбор задачи", durationMinutes: 45 },
    ]) {
      expect((await app.inject({ method: "POST", url: typesUrl, payload: body })).statusCode)
        .toBe(201);
    }

    const catalog = (await app.inject({ method: "GET", url: typesUrl })).json();
    expect(catalog.map((t: { name: string; durationMinutes: number }) => [t.name, t.durationMinutes]))
      .toEqual([["Знакомство", 30], ["Консультация", 45]]);

    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("11:00"), end: iso("12:30") }] },
    });
    const ladder = (
      await app.inject({ method: "GET", url: `${typesUrl}/${catalog[1].id}/slots` })
    ).json();
    expect(at(ladder)).toEqual(["11:00", "11:45"]);

    await app.close();
  });

  it("1. владелец объявляет два интервала — они возвращаются ему целиком", async () => {
    const app = await build();

    const saved = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });
    expect(saved.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: `/api/owners/${enc}/availability` });
    expect(list.json()).toEqual([{ date: day, intervals: workday }]);

    await app.close();
  });

  it("2. лестница гостя повторяет интервалы и рвётся на обеде", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app, 45) })).json();
    // Обед реально разрывает лестницу: 12:30–13:15 не предлагается.
    expect(at(slots)).toEqual([
      "11:00",
      "11:45",
      "14:00",
      "14:45",
      "15:30",
      "16:15",
      "17:00",
    ]);
    expect(slots.every((slot: { status: string }) => slot.status === "free")).toBe(true);

    await app.close();
  });

  it("3. гость бронирует ячейку в середине — соседние остаются свободными", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });

    const booked = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 45),
      payload: { ...guest, start: iso("14:45") },
    });
    expect(booked.statusCode).toBe(201);
    expect(booked.json().end).toBe(iso("15:30"));

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app, 45) })).json();
    const byTime = Object.fromEntries(
      slots.map((slot: { start: string; status: string }) => [
        slot.start.slice(11, 16),
        slot.status,
      ]),
    );
    expect(byTime).toMatchObject({
      "14:00": "free",
      "14:45": "busy",
      "15:30": "free",
    });

    await app.close();
  });

  it("4. бронь одного типа встречи занимает пересекающиеся слоты других типов", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 45),
      payload: { ...guest, start: iso("14:45") },
    });

    for (const duration of [15, 30]) {
      const slots = (await app.inject({ method: "GET", url: await slotsUrl(app, duration) })).json();
      const busy = slots.filter((slot: { status: string }) => slot.status === "busy");
      expect(busy.length).toBeGreaterThan(0);
      // Всё занятое лежит внутри 14:45–15:30 и ничего не торчит наружу.
      for (const slot of busy) {
        expect(slot.start >= iso("14:30")).toBe(true);
        expect(slot.end <= iso("15:45")).toBe(true);
      }
    }

    // Записаться на пересекающийся слот другого типа нельзя: 15:00–15:30
    // 30-минутного типа задевает 14:45–15:30 45-минутного.
    const clash = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, guestName: "Другой гость", start: iso("15:00") },
    });
    expect(clash.statusCode).toBe(409);

    await app.close();
  });

  it("5. владелец видит встречу в своём списке", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 45),
      payload: { ...guest, start: iso("14:45") },
    });

    const meetings = (await app.inject({ method: "GET", url: meetingsUrl })).json();
    expect(meetings).toEqual([
      {
        id: expect.any(Number),
        eventTypeId: expect.any(Number),
        eventTypeName: "Встреча 45 мин",
        ownerEmail: owner,
        start: iso("14:45"),
        end: iso("15:30"),
        durationMinutes: 45,
        guestName: "Гость",
        guestEmail: "guest@example.com",
      },
    ]);

    await app.close();
  });

  it("6. второй гость на ту же ячейку получает 409", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 45),
      payload: { ...guest, start: iso("14:45") },
    });

    const second = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 45),
      payload: {
        guestName: "Второй",
        guestEmail: "second@example.com",
        start: iso("14:45"),
      },
    });
    expect(second.statusCode).toBe(409);

    await app.close();
  });

  it("7. сужение дня под бронью — 409 с перечнем встреч; расширение проходит", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 45),
      payload: { ...guest, start: iso("14:45") },
    });

    const narrowed = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("11:00"), end: iso("13:00") }] },
    });
    expect(narrowed.statusCode).toBe(409);
    expect(narrowed.json().meetings).toEqual([
      { start: iso("14:45"), end: iso("15:30"), guestName: "Гость" },
    ]);

    const widened = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("09:00"), end: iso("20:00") }] },
    });
    expect(widened.statusCode).toBe(200);

    await app.close();
  });

  it("8. края: прошедшие ячейки не предлагаются, дата вне окна отвергается", async () => {
    const app = await buildApp({
      dbPath: ":memory:",
      clock: () => new Date(`${day}T15:00:00.000Z`),
    });
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app, 45) })).json();
    expect(at(slots)).toEqual(["15:30", "16:15", "17:00"]);

    const tooFar = await app.inject({
      method: "PUT",
      url: availabilityUrl("2024-05-01"),
      payload: { intervals: [] },
    });
    expect(tooFar.statusCode).toBe(422);

    await app.close();
  });

  it("9. формы ошибок: 422 на кривой запрос, 404 на владельца без доступности", async () => {
    const app = await build();

    const noAvailability = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, start: iso("11:00") },
    });
    expect(noAvailability.statusCode).toBe(404);
    expect(noAvailability.json()).toHaveProperty("message");

    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: workday },
    });

    const badStart = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, start: iso("11:20") },
    });
    expect(badStart.statusCode).toBe(422);
    expect(badStart.json().errors[0]).toMatchObject({ path: "start" });

    await app.close();
  });
});
