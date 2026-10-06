import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { openDatabase } from "../src/db/index.js";

const owner = "owner@example.com";
const eventTypesUrl = `/api/owners/${encodeURIComponent(owner)}/event-types`;

const validBody = {
  name: "Знакомство",
  description: "Первый созвон: знакомимся и обсуждаем идеи",
  duration: 30,
};

// "Сейчас" зафиксировано на 09:47 — ближайшая точка сетки :00/:30 впереди это 10:00.
const now = new Date("2024-01-10T09:47:00.000Z");
const firstSlot = "2024-01-10T10:00:00.000Z";
// Окно — 14 суток от полуночи UTC текущих суток: конец 2024-01-24T00:00:00.000Z (не включая).
const lastSlot = "2024-01-23T23:30:00.000Z";
const windowEndSlot = "2024-01-24T00:00:00.000Z";

// Открываем базу сами (а не через dbPath), чтобы завести фикстуру брони
// напрямую — создающего эндпоинта для неё пока нет (см. #23).
async function buildAppWithEventType() {
  const db = openDatabase(":memory:");
  const app = await buildApp({ db, clock: () => now });
  const created = await app.inject({
    method: "POST",
    url: eventTypesUrl,
    payload: validBody,
  });
  return { app, db, eventTypeId: created.json().id as number };
}

function slotsUrl(eventTypeId: number, ownerEmail = owner): string {
  return `/api/owners/${encodeURIComponent(ownerEmail)}/event-types/${eventTypeId}/slots`;
}

describe("GET /api/owners/:ownerEmail/event-types/:id/slots", () => {
  it("отдаёт сетку :00/:30, обрезанную по окну бронирования", async () => {
    const { app, eventTypeId } = await buildAppWithEventType();

    const res = await app.inject({ method: "GET", url: slotsUrl(eventTypeId) });
    expect(res.statusCode).toBe(200);
    const slots = res.json() as string[];

    // раньше now не предлагаем
    expect(slots).not.toContain("2024-01-10T09:30:00.000Z");
    // первый слот внутри окна — ровно он
    expect(slots[0]).toBe(firstSlot);
    // последний слот внутри окна присутствует, граница окна (00:00) — нет
    expect(slots.at(-1)).toBe(lastSlot);
    expect(slots).not.toContain(windowEndSlot);

    // строго по сетке в 30 минут, без дублей и по возрастанию
    for (let i = 1; i < slots.length; i++) {
      expect(Date.parse(slots[i]) - Date.parse(slots[i - 1])).toBe(
        30 * 60 * 1000,
      );
    }

    await app.close();
  });

  it("исключает занятый владельцем интервал, не трогая соседние слоты", async () => {
    const { app, db, eventTypeId } = await buildAppWithEventType();
    db
      .prepare(
        `INSERT INTO bookings (event_type_id, owner_email, start, end, guest_name, guest_email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        eventTypeId,
        owner,
        "2024-01-11T10:00:00.000Z",
        "2024-01-11T10:30:00.000Z",
        "Гость",
        "guest@example.com",
        now.toISOString(),
      );

    const res = await app.inject({ method: "GET", url: slotsUrl(eventTypeId) });
    const slots = res.json() as string[];

    expect(slots).not.toContain("2024-01-11T10:00:00.000Z");
    // касание границ занятого интервала разрешено
    expect(slots).toContain("2024-01-11T09:30:00.000Z");
    expect(slots).toContain("2024-01-11T10:30:00.000Z");

    await app.close();
  });

  it("отвечает 404 для неизвестного типа встречи", async () => {
    const { app, eventTypeId } = await buildAppWithEventType();

    const res = await app.inject({
      method: "GET",
      url: slotsUrl(eventTypeId + 1000),
    });

    expect(res.statusCode).toBe(404);
    expect(typeof res.json().message).toBe("string");

    await app.close();
  });

  it("отвечает 404, если тип встречи принадлежит другому владельцу", async () => {
    const { app, eventTypeId } = await buildAppWithEventType();

    const res = await app.inject({
      method: "GET",
      url: slotsUrl(eventTypeId, "other@example.com"),
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
