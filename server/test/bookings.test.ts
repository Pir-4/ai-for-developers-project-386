import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const owner = "owner@example.com";
const eventTypesUrl = `/api/owners/${encodeURIComponent(owner)}/event-types`;

const validEventType = {
  name: "Знакомство",
  description: "Первый созвон: знакомимся и обсуждаем идеи",
  duration: 30,
};

// "Сейчас" зафиксировано на 09:47 — ближайшая точка сетки :00/:30 впереди это 10:00.
const now = new Date("2024-01-10T09:47:00.000Z");
const firstSlot = "2024-01-10T10:00:00.000Z";
// Окно — 14 суток от полуночи UTC текущих суток: конец 2024-01-24T00:00:00.000Z (не включая).
const windowEndSlot = "2024-01-24T00:00:00.000Z";

const validGuest = {
  guestName: "Гость",
  guestEmail: "guest@example.com",
};

async function buildAppWithEventTypes(count = 1) {
  const app = await buildApp({ dbPath: ":memory:", clock: () => now });
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const created = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validEventType,
    });
    ids.push(created.json().id as number);
  }
  return { app, ids };
}

function bookingsUrl(eventTypeId: number, ownerEmail = owner): string {
  return `/api/owners/${encodeURIComponent(ownerEmail)}/event-types/${eventTypeId}/bookings`;
}

describe("POST /api/owners/:ownerEmail/event-types/:id/bookings", () => {
  it("бронирует свободный слот и отдаёт 201 с данными брони", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: firstSlot },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.any(Number),
      eventTypeId: ids[0],
      ownerEmail: owner,
      start: firstSlot,
      end: "2024-01-10T10:30:00.000Z",
      guestName: validGuest.guestName,
      guestEmail: validGuest.guestEmail,
      createdAt: now.toISOString(),
    });

    await app.close();
  });

  it("обрезает пробелы вокруг имени гостя", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, guestName: "  Гость  ", start: firstSlot },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().guestName).toBe("Гость");

    await app.close();
  });

  it("принимает имя, которое длиннее 100 символов только за счёт пробелов по краям", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    const padded = `  ${"а".repeat(100)}  `;
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, guestName: padded, start: firstSlot },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().guestName).toBe("а".repeat(100));

    await app.close();
  });

  it("отвечает 404 для неизвестного типа встречи", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0] + 1000),
      payload: { ...validGuest, start: firstSlot },
    });

    expect(res.statusCode).toBe(404);
    expect(typeof res.json().message).toBe("string");

    await app.close();
  });

  it("отвечает 404, если тип встречи принадлежит другому владельцу", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0], "other@example.com"),
      payload: { ...validGuest, start: firstSlot },
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it.each([
    { what: "пустое имя", payload: { ...validGuest, guestName: "" } },
    { what: "имя из одних пробелов", payload: { ...validGuest, guestName: "   " } },
    {
      what: "имя длиннее 100 символов",
      payload: { ...validGuest, guestName: "а".repeat(101) },
    },
    { what: "некорректный email", payload: { ...validGuest, guestEmail: "not-an-email" } },
  ])("отвечает 422, если $what", async ({ payload }) => {
    const { app, ids } = await buildAppWithEventTypes();
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...payload, start: firstSlot },
    });

    expect(res.statusCode).toBe(422);
    expect(typeof res.json().message).toBe("string");

    await app.close();
  });

  it("отвечает 422, если start не на сетке :00/:30", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: "2024-01-10T10:15:00.000Z" },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "start" })]),
    );

    await app.close();
  });

  it("отвечает 422, если start в прошлом", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: "2024-01-10T09:30:00.000Z" },
    });

    expect(res.statusCode).toBe(422);

    await app.close();
  });

  it("отвечает 422, если start за пределами окна бронирования", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: windowEndSlot },
    });

    expect(res.statusCode).toBe(422);

    await app.close();
  });

  it("отвечает 409 при повторном бронировании того же слота тем же типом встречи", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: firstSlot },
    });

    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: firstSlot },
    });

    expect(res.statusCode).toBe(409);
    expect(typeof res.json().message).toBe("string");

    await app.close();
  });

  it("отвечает 409 при пересечении с бронью другого типа встречи того же владельца", async () => {
    const { app, ids } = await buildAppWithEventTypes(2);
    await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: firstSlot },
    });

    const res = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[1]),
      payload: { ...validGuest, start: firstSlot },
    });

    expect(res.statusCode).toBe(409);

    await app.close();
  });

  it("разрешает бронь, касающуюся границы занятого интервала", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    // Занятый интервал [11:00, 11:30) — с запасом от "сейчас" (09:47), чтобы
    // соседние слоты (10:30 и 11:30) не попали под запрет бронирования прошлого.
    await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: "2024-01-10T11:00:00.000Z" },
    });

    const before = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: {
        guestName: "Другой гость",
        guestEmail: "other-guest@example.com",
        start: "2024-01-10T10:30:00.000Z",
      },
    });
    const after = await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: {
        guestName: "Третий гость",
        guestEmail: "third-guest@example.com",
        start: "2024-01-10T11:30:00.000Z",
      },
    });

    expect(before.statusCode).toBe(201);
    expect(after.statusCode).toBe(201);

    await app.close();
  });

  it("сценарий: забронированный слот пропадает из списка свободных", async () => {
    const { app, ids } = await buildAppWithEventTypes();
    await app.inject({
      method: "POST",
      url: bookingsUrl(ids[0]),
      payload: { ...validGuest, start: firstSlot },
    });

    const slots = await app.inject({
      method: "GET",
      url: `${eventTypesUrl}/${ids[0]}/slots`,
    });

    expect(slots.json()).not.toContain(firstSlot);

    await app.close();
  });
});
