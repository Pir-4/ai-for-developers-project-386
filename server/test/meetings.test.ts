import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const owner = "owner@example.com";
const enc = encodeURIComponent(owner);
const availabilityUrl = (date: string) => `/api/owners/${enc}/availability/${date}`;
const bookingsUrl = `/api/owners/${enc}/bookings`;
const meetingsUrl = `/api/owners/${enc}/meetings`;

const now = new Date("2024-01-10T09:47:00.000Z");
const day = "2024-01-11";
const iso = (time: string) => `${day}T${time}:00.000Z`;

const guest = { guestName: "Гость", guestEmail: "guest@example.com" };

const build = (clock: () => Date = () => now) =>
  buildApp({ dbPath: ":memory:", clock });

async function openAndBook(
  app: Awaited<ReturnType<typeof build>>,
  times: string[],
  durationMinutes = 30,
) {
  await app.inject({
    method: "PUT",
    url: availabilityUrl(day),
    payload: { intervals: [{ start: iso("09:00"), end: iso("18:00") }] },
  });
  for (const time of times) {
    await app.inject({
      method: "POST",
      url: bookingsUrl,
      payload: { ...guest, start: iso(time), durationMinutes },
    });
  }
}

describe("будущие встречи владельца", () => {
  it("пусто, пока никто не записался", async () => {
    const app = await build();
    const response = await app.inject({ method: "GET", url: meetingsUrl });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    await app.close();
  });

  it("показывает встречу с длительностью и данными гостя", async () => {
    const app = await build();
    await openAndBook(app, ["11:15"], 45);

    const meetings = (await app.inject({ method: "GET", url: meetingsUrl })).json();
    expect(meetings).toEqual([
      {
        id: expect.any(Number),
        ownerEmail: owner,
        start: iso("11:15"),
        end: iso("12:00"),
        durationMinutes: 45,
        guestName: "Гость",
        guestEmail: "guest@example.com",
      },
    ]);
    await app.close();
  });

  it("сортирует по началу, а не по порядку создания", async () => {
    const app = await build();
    await openAndBook(app, ["15:00", "10:00", "12:00"]);

    const meetings = (await app.inject({ method: "GET", url: meetingsUrl })).json();
    expect(meetings.map((m: { start: string }) => m.start.slice(11, 16))).toEqual([
      "10:00",
      "12:00",
      "15:00",
    ]);
    await app.close();
  });

  it("завершившиеся встречи уходят из списка", async () => {
    // База переживает смену «сейчас»: бронируем при одних часах, читаем при других.
    const db = (await import("../src/db/index.js")).openDatabase(":memory:");
    const booking = await buildApp({ db, clock: () => now });
    await openAndBook(booking, ["10:00", "16:00"]);
    // Закрывать нельзя — закрытие уронит общую базу; просто берём новый app.

    const later = await buildApp({
      db,
      clock: () => new Date(`${day}T12:00:00.000Z`),
    });
    const meetings = (await later.inject({ method: "GET", url: meetingsUrl })).json();
    expect(meetings.map((m: { start: string }) => m.start.slice(11, 16))).toEqual([
      "16:00",
    ]);
    await later.close();
  });

  it("встречи одного владельца не видны другому", async () => {
    const app = await build();
    await openAndBook(app, ["11:00"]);

    const other = await app.inject({
      method: "GET",
      url: `/api/owners/${encodeURIComponent("other@example.com")}/meetings`,
    });
    expect(other.json()).toEqual([]);
    await app.close();
  });
});
