import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { bookingsUrl, slotsUrl, slotsUrlOf } from "./event-type-urls.js";

const availabilityUrl = (date: string) => `/api/availability/${date}`;

const now = new Date("2024-01-10T09:47:00.000Z");
const day = "2024-01-11";
const iso = (time: string) => `${day}T${time}:00.000Z`;

const build = () => buildApp({ dbPath: ":memory:", clock: () => now });

async function openDay(
  app: Awaited<ReturnType<typeof build>>,
  intervals: { start: string; end: string }[],
  date = day,
) {
  await app.inject({ method: "PUT", url: availabilityUrl(date), payload: { intervals } });
}

const times = (slots: { start: string }[]) =>
  slots.map((slot) => slot.start.slice(11, 16));

describe("лестница слотов для гостя", () => {
  it("пустая, пока владелец не открыл ни одного дня", async () => {
    const app = await build();
    const response = await app.inject({ method: "GET", url: await slotsUrl(app) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    await app.close();
  });

  it("плоский список, упорядоченный по началу", async () => {
    const app = await build();
    await openDay(app, [{ start: iso("11:00"), end: iso("12:00") }]);
    await openDay(app, [
      { start: "2024-01-12T09:00:00.000Z", end: "2024-01-12T10:00:00.000Z" },
    ], "2024-01-12");

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    expect(slots.map((slot: { start: string }) => slot.start)).toEqual([
      iso("11:00"),
      iso("11:30"),
      "2024-01-12T09:00:00.000Z",
      "2024-01-12T09:30:00.000Z",
    ]);
    await app.close();
  });

  it("каждый слот — 30 минут, начинается на :00 или :30 и несёт статус", async () => {
    const app = await build();
    await openDay(app, [{ start: iso("10:00"), end: iso("12:00") }]);

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    expect(slots).toEqual([
      { start: iso("10:00"), end: iso("10:30"), status: "free" },
      { start: iso("10:30"), end: iso("11:00"), status: "free" },
      { start: iso("11:00"), end: iso("11:30"), status: "free" },
      { start: iso("11:30"), end: iso("12:00"), status: "free" },
    ]);
    await app.close();
  });

  it("никогда не отдаёт слоты дальше сегодня + 13", async () => {
    const app = await build();
    // Последний день окна — 2024-01-23; интервал заходит за полночь в 2024-01-24.
    await openDay(app, [
      { start: "2024-01-23T23:00:00.000Z", end: "2024-01-24T01:00:00.000Z" },
    ], "2024-01-23");

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    expect(slots.map((slot: { start: string }) => slot.start)).toEqual([
      "2024-01-23T23:00:00.000Z",
      "2024-01-23T23:30:00.000Z",
    ]);
    await app.close();
  });

  it("показывает занятые ячейки, а не прячет их", async () => {
    const app = await build();
    await openDay(app, [{ start: iso("11:00"), end: iso("12:00") }]);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: {
        guestName: "Гость",
        guestEmail: "guest@example.com",
        start: iso("11:30"),
      },
    });

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    expect(slots).toEqual([
      { start: iso("11:00"), end: iso("11:30"), status: "free" },
      { start: iso("11:30"), end: iso("12:00"), status: "busy" },
    ]);
    await app.close();
  });

  it("занятая ячейка не раскрывает ничего о другом госте", async () => {
    const app = await build();
    await openDay(app, [{ start: iso("11:00"), end: iso("11:30") }]);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: {
        guestName: "Секретный Гость",
        guestEmail: "secret@example.com",
        start: iso("11:00"),
      },
    });

    const body = (await app.inject({ method: "GET", url: await slotsUrl(app) })).body;
    expect(body).not.toContain("Секретный");
    expect(body).not.toContain("secret@example.com");
    await app.close();
  });

  it("не отдаёт ячейки, которые уже начались", async () => {
    const app = await buildApp({
      dbPath: ":memory:",
      clock: () => new Date("2024-01-10T13:20:00.000Z"),
    });
    await app.inject({
      method: "PUT",
      url: availabilityUrl("2024-01-10"),
      payload: {
        intervals: [
          { start: "2024-01-10T13:00:00.000Z", end: "2024-01-10T15:00:00.000Z" },
        ],
      },
    });

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    expect(times(slots)).toEqual(["13:30", "14:00", "14:30"]);
    await app.close();
  });

  it("404 на неизвестный тип встречи", async () => {
    const app = await build();
    const response = await app.inject({ method: "GET", url: slotsUrlOf(999) });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
