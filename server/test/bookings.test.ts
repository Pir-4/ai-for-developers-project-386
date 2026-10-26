import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  bookingsUrl,
  bookingsUrlOf,
  createEventType,
  eventTypeId,
  slotsUrl,
  slotsUrlOf,
} from "./event-type-urls.js";

const availabilityUrl = (date: string) => `/api/availability/${date}`;

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
  it("создаёт 30-минутную бронь", async () => {
    const app = await build();
    await openMorning(app);

    const response = await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("11:30") },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(Number),
      eventTypeId: await eventTypeId(app),
      start: iso("11:30"),
      end: iso("12:00"),
      durationMinutes: 30,
      guestName: "Гость",
      guestEmail: "guest@example.com",
      createdAt: now.toISOString(),
    });

    await app.close();
  });

  it("бронь часового типа длится час", async () => {
    const app = await build();
    await openMorning(app);
    const id = await createEventType(app, "Консультация", 60);

    const response = await app.inject({
      method: "POST",
      url: bookingsUrlOf(id),
      payload: { ...guest, start: iso("11:30") },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      start: iso("11:30"),
      end: iso("12:30"),
      durationMinutes: 60,
    });

    await app.close();
  });

  it("404, если владелец не открыл ни одного дня", async () => {
    const app = await build();
    const response = await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("11:00") },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("422, если время не является ступенькой лестницы", async () => {
    const app = await build();
    await openMorning(app);

    // 11:20 не на сетке вовсе; 11:15 — на старой 15-минутной, но не на 30-минутной;
    // 15:00 — конец интервала, слот туда уже не помещается.
    for (const start of [iso("11:20"), iso("11:15"), iso("15:00")]) {
      const response = await app.inject({
        method: "POST",
        url: await bookingsUrl(app),
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
    const url = await bookingsUrl(app);
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

  it("касание границ не конфликтует", async () => {
    const app = await build();
    await openMorning(app);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("11:00") },
    });

    const touching = await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
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
      url: await bookingsUrl(app),
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
      url: await bookingsUrl(app),
      payload: { ...guest, guestEmail: "не почта", start: iso("11:00") },
    });
    expect(response.statusCode).toBe(422);

    await app.close();
  });

  it("хранит и отдаёт начало в каноническом UTC, даже если оно пришло со смещением", async () => {
    const app = await build();
    await openMorning(app);

    // 14:00+03:00 — это ступенька 11:00Z.
    const response = await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: `${day}T14:00:00+03:00` },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ start: iso("11:00"), end: iso("11:30") });

    const meetings = (await app.inject({ method: "GET", url: "/api/meetings" })).json();
    expect(meetings[0].start).toBe(iso("11:00"));

    await app.close();
  });

  it("404 на неизвестный тип встречи", async () => {
    const app = await build();
    await openMorning(app);

    const response = await app.inject({
      method: "POST",
      url: bookingsUrlOf(999),
      payload: { ...guest, start: iso("11:00") },
    });
    expect(response.statusCode).toBe(404);

    await app.close();
  });

  describe("конфликт между разными типами встречи", () => {
    // Два типа над одним интервалом 11:00–15:00: занятость у них общая.
    it("бронь одного типа занимает тот же слот другого, и бронировать его — 409", async () => {
      const app = await build();
      await openMorning(app);
      const intro = await createEventType(app, "Знакомство");
      const consult = await createEventType(app, "Консультация");

      const first = await app.inject({
        method: "POST",
        url: bookingsUrlOf(intro),
        payload: { ...guest, start: iso("11:00") },
      });
      expect(first.statusCode).toBe(201);

      const ladder = (await app.inject({ method: "GET", url: slotsUrlOf(consult) })).json();
      expect(ladder.slice(0, 2)).toEqual([
        { start: iso("11:00"), end: iso("11:30"), status: "busy" },
        { start: iso("11:30"), end: iso("12:00"), status: "free" },
      ]);

      const clash = await app.inject({
        method: "POST",
        url: bookingsUrlOf(consult),
        payload: { ...guest, guestName: "Другой", start: iso("11:00") },
      });
      expect(clash.statusCode).toBe(409);

      const next = await app.inject({
        method: "POST",
        url: bookingsUrlOf(consult),
        payload: { ...guest, guestName: "Другой", start: iso("11:30") },
      });
      expect(next.statusCode).toBe(201);

      await app.close();
    });

    it("короткая бронь занимает обе часовые ячейки, которые её задевают", async () => {
      const app = await build();
      await openMorning(app);
      const intro = await createEventType(app, "Знакомство", 30);
      const consult = await createEventType(app, "Консультация", 60);

      await app.inject({
        method: "POST",
        url: bookingsUrlOf(intro),
        payload: { ...guest, start: iso("12:00") },
      });

      const ladder = (await app.inject({ method: "GET", url: slotsUrlOf(consult) })).json();
      const busy = ladder
        .filter((slot: { status: string }) => slot.status === "busy")
        .map((slot: { start: string }) => slot.start);
      expect(busy).toEqual([iso("11:30"), iso("12:00")]);

      const clash = await app.inject({
        method: "POST",
        url: bookingsUrlOf(consult),
        payload: { ...guest, guestName: "Другой", start: iso("11:30") },
      });
      expect(clash.statusCode).toBe(409);

      await app.close();
    });
  });

  it("забронированная ячейка сразу уходит из свободных", async () => {
    const app = await build();
    await openMorning(app);
    await app.inject({
      method: "POST",
      url: await bookingsUrl(app),
      payload: { ...guest, start: iso("11:00") },
    });

    const slots = (await app.inject({ method: "GET", url: await slotsUrl(app) })).json();
    const free = slots.filter((slot: { status: string }) => slot.status === "free");
    expect(free.some((slot: { start: string }) => slot.start === iso("11:00"))).toBe(false);

    await app.close();
  });
});
