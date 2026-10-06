import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const owner = "owner@example.com";
const enc = encodeURIComponent(owner);
const availabilityUrl = (date: string) => `/api/owners/${enc}/availability/${date}`;
const slotsUrl = (duration: number) => `/api/owners/${enc}/slots?duration=${duration}`;
const bookingsUrl = `/api/owners/${enc}/bookings`;

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
    const response = await app.inject({ method: "GET", url: slotsUrl(30) });
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

    const slots = (await app.inject({ method: "GET", url: slotsUrl(30) })).json();
    expect(slots.map((slot: { start: string }) => slot.start)).toEqual([
      iso("11:00"),
      iso("11:30"),
      "2024-01-12T09:00:00.000Z",
      "2024-01-12T09:30:00.000Z",
    ]);
    await app.close();
  });

  it("каждая ячейка несёт конец и статус", async () => {
    const app = await build();
    await openDay(app, [{ start: iso("11:00"), end: iso("11:45") }]);

    const slots = (await app.inject({ method: "GET", url: slotsUrl(45) })).json();
    expect(slots).toEqual([
      { start: iso("11:00"), end: iso("11:45"), status: "free" },
    ]);
    await app.close();
  });

  it("длительность меняет лестницу", async () => {
    const app = await build();
    await openDay(app, [{ start: iso("11:00"), end: iso("15:00") }]);

    const counts = await Promise.all(
      [15, 30, 45].map(async (duration) =>
        (await app.inject({ method: "GET", url: slotsUrl(duration) })).json().length,
      ),
    );
    expect(counts).toEqual([16, 8, 5]);
    await app.close();
  });

  it("показывает занятые ячейки, а не прячет их", async () => {
    const app = await build();
    await openDay(app, [{ start: iso("11:00"), end: iso("12:00") }]);
    await app.inject({
      method: "POST",
      url: bookingsUrl,
      payload: {
        guestName: "Гость",
        guestEmail: "guest@example.com",
        start: iso("11:30"),
        durationMinutes: 30,
      },
    });

    const slots = (await app.inject({ method: "GET", url: slotsUrl(30) })).json();
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
      url: bookingsUrl,
      payload: {
        guestName: "Секретный Гость",
        guestEmail: "secret@example.com",
        start: iso("11:00"),
        durationMinutes: 30,
      },
    });

    const body = (await app.inject({ method: "GET", url: slotsUrl(30) })).body;
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
          { start: "2024-01-10T11:00:00.000Z", end: "2024-01-10T15:00:00.000Z" },
        ],
      },
    });

    const slots = (await app.inject({ method: "GET", url: slotsUrl(45) })).json();
    expect(times(slots)).toEqual(["14:00"]);
    await app.close();
  });

  it("422, если длительность не 15/30/45", async () => {
    const app = await build();
    const response = await app.inject({ method: "GET", url: slotsUrl(20) });
    expect(response.statusCode).toBe(422);
    await app.close();
  });

  it("брони другого владельца не занимают слоты этого", async () => {
    const app = await build();
    await openDay(app, [{ start: iso("11:00"), end: iso("11:30") }]);

    const other = encodeURIComponent("other@example.com");
    await app.inject({
      method: "PUT",
      url: `/api/owners/${other}/availability/${day}`,
      payload: { intervals: [{ start: iso("11:00"), end: iso("11:30") }] },
    });
    await app.inject({
      method: "POST",
      url: `/api/owners/${other}/bookings`,
      payload: {
        guestName: "Гость",
        guestEmail: "guest@example.com",
        start: iso("11:00"),
        durationMinutes: 30,
      },
    });

    const slots = (await app.inject({ method: "GET", url: slotsUrl(30) })).json();
    expect(slots[0].status).toBe("free");
    await app.close();
  });
});
