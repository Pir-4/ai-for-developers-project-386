// Полный сценарный набор (issue #25, "Testing Decisions" спеки #18): шесть
// обязательных сценариев как единая история через HTTP-границу сервера
// (app.inject(), фиксированные часы, :memory: БД) — итоговый критерий качества
// фичи, отдельный от точечных тестов на каждый эндпоинт в соседних файлах.
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
// Окно — 14 суток от полуночи UTC текущих суток: последний слот внутри окна —
// 23:30 накануне границы, граница (полночь) уже не входит.
const lastSlotInWindow = "2024-01-23T23:30:00.000Z";
const firstSlotOutsideWindow = "2024-01-24T00:00:00.000Z";

const validGuest = { guestName: "Гость", guestEmail: "guest@example.com" };

function bookingsUrl(eventTypeId: number): string {
  return `${eventTypesUrl}/${eventTypeId}/bookings`;
}

function slotsUrl(eventTypeId: number): string {
  return `${eventTypesUrl}/${eventTypeId}/slots`;
}

const meetingsUrl = `/api/owners/${encodeURIComponent(owner)}/meetings`;

describe("Полный сценарный набор: создание типа → гостевой список → слоты → бронь → встречи владельца", () => {
  it("1. владелец создаёт тип встречи — он появляется в гостевом списке типов", async () => {
    const app = await buildApp({ dbPath: ":memory:", clock: () => now });

    const created = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validEventType,
    });
    expect(created.statusCode).toBe(201);
    const eventTypeId = created.json().id as number;

    const guestList = await app.inject({ method: "GET", url: eventTypesUrl });
    expect(guestList.statusCode).toBe(200);
    expect(guestList.json()).toEqual([
      { id: eventTypeId, ownerEmail: owner, ...validEventType },
    ]);

    await app.close();
  });

  it("2. список слотов — сетка :00/:30, обрезанная по окну, без забронированных", async () => {
    const app = await buildApp({ dbPath: ":memory:", clock: () => now });
    const created = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validEventType,
    });
    const eventTypeId = created.json().id as number;

    const before = await app.inject({ method: "GET", url: slotsUrl(eventTypeId) });
    const slotsBefore = before.json() as string[];
    expect(slotsBefore[0]).toBe(firstSlot);
    expect(slotsBefore.at(-1)).toBe(lastSlotInWindow);
    expect(slotsBefore).not.toContain(firstSlotOutsideWindow);

    await app.inject({
      method: "POST",
      url: bookingsUrl(eventTypeId),
      payload: { ...validGuest, start: firstSlot },
    });

    const after = await app.inject({ method: "GET", url: slotsUrl(eventTypeId) });
    expect(after.json()).not.toContain(firstSlot);

    await app.close();
  });

  it("3. гость бронирует слот — встреча появляется в списке владельца", async () => {
    const app = await buildApp({ dbPath: ":memory:", clock: () => now });
    const created = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validEventType,
    });
    const eventTypeId = created.json().id as number;

    const booked = await app.inject({
      method: "POST",
      url: bookingsUrl(eventTypeId),
      payload: { ...validGuest, start: firstSlot },
    });
    expect(booked.statusCode).toBe(201);
    const booking = booked.json();

    const meetings = await app.inject({ method: "GET", url: meetingsUrl });
    expect(meetings.statusCode).toBe(200);
    expect(meetings.json()).toEqual([
      {
        id: booking.id,
        eventTypeId,
        eventTypeName: validEventType.name,
        ownerEmail: owner,
        start: booking.start,
        end: booking.end,
        guestName: validGuest.guestName,
        guestEmail: validGuest.guestEmail,
      },
    ]);

    await app.close();
  });

  it("4. пересечение брони — 409, включая другой тип встречи; касание границ разрешено", async () => {
    const app = await buildApp({ dbPath: ":memory:", clock: () => now });
    const first = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validEventType,
    });
    const second = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: { ...validEventType, name: "Карьерный разбор" },
    });
    const firstId = first.json().id as number;
    const secondId = second.json().id as number;

    // Занятый интервал [11:00, 11:30) — с запасом от "сейчас" (09:47), чтобы
    // соседний слот ДО него (10:30) не попал под запрет бронирования прошлого.
    const occupiedStart = "2024-01-10T11:00:00.000Z";
    await app.inject({
      method: "POST",
      url: bookingsUrl(firstId),
      payload: { ...validGuest, start: occupiedStart },
    });

    const sameTypeOverlap = await app.inject({
      method: "POST",
      url: bookingsUrl(firstId),
      payload: { ...validGuest, start: occupiedStart },
    });
    expect(sameTypeOverlap.statusCode).toBe(409);

    const crossTypeOverlap = await app.inject({
      method: "POST",
      url: bookingsUrl(secondId),
      payload: { ...validGuest, start: occupiedStart },
    });
    expect(crossTypeOverlap.statusCode).toBe(409);

    // Соседние слоты, лишь касающиеся границ занятого [11:00, 11:30) — разрешены
    // с обеих сторон: конец соседнего совпадает с началом занятого, и наоборот.
    const touchingBeforeOccupied = await app.inject({
      method: "POST",
      url: bookingsUrl(firstId),
      payload: { ...validGuest, start: "2024-01-10T10:30:00.000Z" },
    });
    expect(touchingBeforeOccupied.statusCode).toBe(201);

    const touchingAfterOccupied = await app.inject({
      method: "POST",
      url: bookingsUrl(firstId),
      payload: { ...validGuest, start: "2024-01-10T11:30:00.000Z" },
    });
    expect(touchingAfterOccupied.statusCode).toBe(201);

    await app.close();
  });

  it("5. границы окна бронирования — прошлое отклонено, последний слот разрешён, первый за окном отклонён", async () => {
    const app = await buildApp({ dbPath: ":memory:", clock: () => now });
    const created = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validEventType,
    });
    const eventTypeId = created.json().id as number;

    const past = await app.inject({
      method: "POST",
      url: bookingsUrl(eventTypeId),
      payload: { ...validGuest, start: "2024-01-10T09:30:00.000Z" },
    });
    expect(past.statusCode).toBe(422);

    const lastInWindow = await app.inject({
      method: "POST",
      url: bookingsUrl(eventTypeId),
      payload: { ...validGuest, start: lastSlotInWindow },
    });
    expect(lastInWindow.statusCode).toBe(201);

    const firstOutside = await app.inject({
      method: "POST",
      url: bookingsUrl(eventTypeId),
      payload: { ...validGuest, start: firstSlotOutsideWindow },
    });
    expect(firstOutside.statusCode).toBe(422);

    await app.close();
  });

  it("6. 422 на некорректный ввод, 404 на неизвестный тип встречи", async () => {
    const app = await buildApp({ dbPath: ":memory:", clock: () => now });

    const invalidDuration = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: { ...validEventType, duration: 7 },
    });
    expect(invalidDuration.statusCode).toBe(422);

    const durationOutOfRange = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: { ...validEventType, duration: 255 },
    });
    expect(durationOutOfRange.statusCode).toBe(422);

    const emptyName = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: { ...validEventType, name: "" },
    });
    expect(emptyName.statusCode).toBe(422);

    const created = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validEventType,
    });
    const eventTypeId = created.json().id as number;

    const invalidGuestEmail = await app.inject({
      method: "POST",
      url: bookingsUrl(eventTypeId),
      payload: { guestName: "Гость", guestEmail: "not-an-email", start: firstSlot },
    });
    expect(invalidGuestEmail.statusCode).toBe(422);

    const unknownEventType = await app.inject({
      method: "POST",
      url: bookingsUrl(eventTypeId + 1000),
      payload: { ...validGuest, start: firstSlot },
    });
    expect(unknownEventType.statusCode).toBe(404);

    await app.close();
  });
});
