import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { eventTypeId, eventTypeUrls } from "./event-type-urls.js";

const owner = "owner@example.com";
const enc = encodeURIComponent(owner);
const availabilityUrl = (date: string) => `/api/owners/${enc}/availability/${date}`;
const { slotsUrl, bookingsUrl } = eventTypeUrls(owner);

const now = new Date("2024-01-10T09:47:00.000Z");
const day = "2024-01-11";
const iso = (time: string) => `${day}T${time}:00.000Z`;

const guest = { guestName: "Гость", guestEmail: "guest@example.com" };

const build = () => buildApp({ dbPath: ":memory:", clock: () => now });

async function openMorning(app: Awaited<ReturnType<typeof build>>) {
  await app.inject({
    method: "PUT",
    url: availabilityUrl(day),
    payload: { intervals: [{ start: iso("11:00"), end: iso("15:00") }] },
  });
}

describe("бронирование слота", () => {
  it("создаёт бронь и выводит конец из длительности", async () => {
    const app = await build();
    await openMorning(app);

    const response = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 45),
      payload: { ...guest, start: iso("11:45") },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      ownerEmail: owner,
      start: iso("11:45"),
      end: iso("12:30"),
      durationMinutes: 45,
      guestName: "Гость",
      guestEmail: "guest@example.com",
    });
    expect(response.json().createdAt).toBe(now.toISOString());

    await app.close();
  });

  it("404, если владелец не открыл ни одного дня", async () => {
    const app = await build();
    const response = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, start: iso("11:00") },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("422, если время не является ступенькой лестницы", async () => {
    const app = await build();
    await openMorning(app);

    // 11:20 не на сетке вовсе; 11:30 — ступенька для 30, но не для 45.
    for (const [start, durationMinutes] of [
      [iso("11:20"), 45],
      [iso("11:30"), 45],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: await bookingsUrl(app, durationMinutes),
        payload: { ...guest, start },
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().errors[0].path).toBe("start");
    }

    await app.close();
  });

  it("409, если ячейку уже заняли", async () => {
    const app = await build();
    await openMorning(app);
    const url = await bookingsUrl(app, 30);
    const payload = { ...guest, start: iso("11:00") };

    expect((await app.inject({ method: "POST", url, payload })).statusCode).toBe(201);
    const second = await app.inject({
      method: "POST",
      url,
      payload: { ...payload, guestName: "Другой" },
    });
    expect(second.statusCode).toBe(409);

    await app.close();
  });

  it("409 и для пересекающейся ячейки другой длительности", async () => {
    const app = await build();
    await openMorning(app);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 45),
      payload: { ...guest, start: iso("11:00") },
    });

    // 11:30–12:00 пересекает 11:00–11:45, хотя это другая лестница.
    const clash = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, start: iso("11:30") },
    });
    expect(clash.statusCode).toBe(409);

    await app.close();
  });

  it("касание границ не конфликтует", async () => {
    const app = await build();
    await openMorning(app);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, start: iso("11:00") },
    });

    const touching = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, start: iso("11:30") },
    });
    expect(touching.statusCode).toBe(201);

    await app.close();
  });

  it("422, если имя пустое после обрезки пробелов", async () => {
    const app = await build();
    await openMorning(app);

    const response = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, guestName: "   ", start: iso("11:00") },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().errors[0].path).toBe("guestName");

    await app.close();
  });

  it("422, если почта не похожа на почту", async () => {
    const app = await build();
    await openMorning(app);

    const response = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, guestEmail: "не почта", start: iso("11:00") },
    });
    expect(response.statusCode).toBe(422);

    await app.close();
  });

  it("404 на неизвестный или чужой тип встречи", async () => {
    const app = await build();
    await openMorning(app);
    const foreignId = await eventTypeId(app, "other@example.com", 30);

    for (const id of [999, foreignId]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/owners/${enc}/event-types/${id}/bookings`,
        payload: { ...guest, start: iso("11:00") },
      });
      expect(response.statusCode).toBe(404);
    }

    await app.close();
  });

  it("длительность брони берётся из типа встречи", async () => {
    const app = await build();
    await openMorning(app);

    const response = await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 60),
      payload: { ...guest, start: iso("12:00") },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      eventTypeId: await eventTypeId(app, owner, 60),
      start: iso("12:00"),
      end: iso("13:00"),
      durationMinutes: 60,
    });

    await app.close();
  });

  describe("конфликт между разными типами встречи", () => {
    // Два типа одного владельца — 30 и 45 минут — над одним интервалом 11:00–15:00.
    it("бронь 30-минутного типа занимает пересекающиеся слоты 45-минутного", async () => {
      const app = await build();
      await openMorning(app);

      const first = await app.inject({
        method: "POST",
        url: await bookingsUrl(app, 30),
        payload: { ...guest, start: iso("11:00") },
      });
      expect(first.statusCode).toBe(201);

      const ladder45 = (await app.inject({ method: "GET", url: await slotsUrl(app, 45) })).json();
      expect(ladder45.slice(0, 2)).toEqual([
        { start: iso("11:00"), end: iso("11:45"), status: "busy" },
        { start: iso("11:45"), end: iso("12:30"), status: "free" },
      ]);

      const clash = await app.inject({
        method: "POST",
        url: await bookingsUrl(app, 45),
        payload: { ...guest, guestName: "Другой", start: iso("11:00") },
      });
      expect(clash.statusCode).toBe(409);

      const next = await app.inject({
        method: "POST",
        url: await bookingsUrl(app, 45),
        payload: { ...guest, guestName: "Другой", start: iso("11:45") },
      });
      expect(next.statusCode).toBe(201);

      await app.close();
    });

    it("и в обратную сторону: бронь 45-минутного типа даёт 409 для 30-минутного", async () => {
      const app = await build();
      await openMorning(app);
      await app.inject({
        method: "POST",
        url: await bookingsUrl(app, 45),
        payload: { ...guest, start: iso("11:00") },
      });

      // 11:30–12:00 задевает хвост 11:00–11:45, хотя это другой тип и другая лестница.
      const clash = await app.inject({
        method: "POST",
        url: await bookingsUrl(app, 30),
        payload: { ...guest, guestName: "Другой", start: iso("11:30") },
      });
      expect(clash.statusCode).toBe(409);

      // 12:00 у 30-минутного типа уже не пересекается — свободно.
      const after = await app.inject({
        method: "POST",
        url: await bookingsUrl(app, 30),
        payload: { ...guest, guestName: "Другой", start: iso("12:00") },
      });
      expect(after.statusCode).toBe(201);

      await app.close();
    });
  });

  it("забронированная ячейка сразу уходит из свободных", async () => {
    const app = await build();
    await openMorning(app);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app, 30),
      payload: { ...guest, start: iso("11:00") },
    });

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app, 30) })).json();
    const free = slots.filter((slot: { status: string }) => slot.status === "free");
    expect(free.some((slot: { start: string }) => slot.start === iso("11:00"))).toBe(false);

    await app.close();
  });
});
