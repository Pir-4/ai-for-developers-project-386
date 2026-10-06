import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const owner = "owner@example.com";
const enc = encodeURIComponent(owner);
const availabilityUrl = (date: string) => `/api/owners/${enc}/availability/${date}`;
const listUrl = `/api/owners/${enc}/availability`;
const bookingsUrl = `/api/owners/${enc}/bookings`;

const now = new Date("2024-01-10T09:47:00.000Z");
const day = "2024-01-11";
const iso = (time: string) => `${day}T${time}:00.000Z`;

const build = () => buildApp({ dbPath: ":memory:", clock: () => now });

const morning = { start: iso("11:00"), end: iso("15:00") };

describe("доступность владельца", () => {
  it("сохраняет интервалы дня и отдаёт их в списке", async () => {
    const app = await build();

    const saved = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [morning] },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ date: day, intervals: [morning] });

    const list = await app.inject({ method: "GET", url: listUrl });
    expect(list.json()).toEqual([{ date: day, intervals: [morning] }]);

    await app.close();
  });

  it("принимает несколько интервалов в одном дне", async () => {
    const app = await build();
    const intervals = [
      { start: iso("11:00"), end: iso("13:00") },
      { start: iso("14:00"), end: iso("18:00") },
    ];

    const saved = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().intervals).toEqual(intervals);

    await app.close();
  });

  it("заменяет день целиком, а не дописывает к нему", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [morning] },
    });

    const replacement = { start: iso("09:00"), end: iso("10:00") };
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [replacement] },
    });

    const list = await app.inject({ method: "GET", url: listUrl });
    expect(list.json()).toEqual([{ date: day, intervals: [replacement] }]);

    await app.close();
  });

  it("пустой список закрывает день", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [morning] },
    });

    const closed = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [] },
    });
    expect(closed.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: listUrl });
    expect(list.json()).toEqual([]);

    await app.close();
  });

  it("422, если конец не позже начала", async () => {
    const app = await build();
    const response = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("11:00"), end: iso("11:00") }] },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().errors).toEqual([
      { path: "intervals/0/end", message: "must be after start" },
    ]);

    await app.close();
  });

  it("422, если интервалы дня пересекаются", async () => {
    const app = await build();
    const response = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: {
        intervals: [
          { start: iso("11:00"), end: iso("13:00") },
          { start: iso("12:00"), end: iso("14:00") },
        ],
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().errors[0].message).toBe("must not overlap each other");

    await app.close();
  });

  it("422, если граница не на 15-минутной сетке", async () => {
    const app = await build();
    const response = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("11:07"), end: iso("15:00") }] },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().errors[0].message).toBe("must lie on the 15-minute grid");

    await app.close();
  });

  it("422, если дата вне окна бронирования", async () => {
    const app = await build();
    const response = await app.inject({
      method: "PUT",
      url: availabilityUrl("2024-03-01"),
      payload: { intervals: [] },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().errors).toEqual([
      { path: "date", message: "must be within the booking window" },
    ]);

    await app.close();
  });

  it("409 при попытке убрать доступность из-под брони, с перечнем встреч", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [morning] },
    });
    await app.inject({
      method: "POST",
      url: bookingsUrl,
      payload: {
        guestName: "Гость",
        guestEmail: "guest@example.com",
        start: iso("12:30"),
        durationMinutes: 45,
      },
    });

    const narrowed = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("11:00"), end: iso("12:00") }] },
    });
    expect(narrowed.statusCode).toBe(409);
    expect(narrowed.json().meetings).toEqual([
      { start: iso("12:30"), end: iso("13:15"), guestName: "Гость" },
    ]);

    // Отказ ничего не сохранил: день остался прежним.
    const list = await app.inject({ method: "GET", url: listUrl });
    expect(list.json()).toEqual([{ date: day, intervals: [morning] }]);

    await app.close();
  });

  it("разрешает расширить день, в котором уже есть встреча", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [morning] },
    });
    await app.inject({
      method: "POST",
      url: bookingsUrl,
      payload: {
        guestName: "Гость",
        guestEmail: "guest@example.com",
        start: iso("12:30"),
        durationMinutes: 45,
      },
    });

    const widened = await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [{ start: iso("09:00"), end: iso("18:00") }] },
    });
    expect(widened.statusCode).toBe(200);

    await app.close();
  });

  it("доступность одного владельца не видна другому", async () => {
    const app = await build();
    await app.inject({
      method: "PUT",
      url: availabilityUrl(day),
      payload: { intervals: [morning] },
    });

    const other = await app.inject({
      method: "GET",
      url: `/api/owners/${encodeURIComponent("other@example.com")}/availability`,
    });
    expect(other.json()).toEqual([]);

    await app.close();
  });
});
