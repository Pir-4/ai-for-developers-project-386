import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { bookingsUrl } from "./event-type-urls.js";

const availabilityUrl = (date: string) => `/api/availability/${date}`;
const meetingsUrl = "/api/meetings";

const now = new Date("2024-01-10T09:47:00.000Z");
const day = "2024-01-11";
const iso = (time: string) => `${day}T${time}:00.000Z`;

const guest = { guestName: "Гость", guestEmail: "guest@example.com" };

const build = (clock: () => Date = () => now) =>
  buildApp({ dbPath: ":memory:", clock });

async function openAndBook(
  app: Awaited<ReturnType<typeof build>>,
  times: string[],
) {
  await app.inject({
    method: "PUT",
    url: availabilityUrl(day),
    payload: { intervals: [{ start: iso("09:00"), end: iso("18:00") }] },
  });
  for (const time of times) {
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso(time) },
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
    await openAndBook(app, ["11:30"]);

    const meetings = (await app.inject({ method: "GET", url: meetingsUrl })).json();
    expect(meetings).toEqual([
      {
        id: expect.any(Number),
        eventTypeId: expect.any(Number),
        eventTypeName: "Встреча",
        start: iso("11:30"),
        end: iso("12:00"),
        durationMinutes: 30,
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
});
