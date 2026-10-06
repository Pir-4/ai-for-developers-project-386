import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const owner = "owner@example.com";

const validEventType = {
  name: "Знакомство",
  description: "Первый созвон: знакомимся и обсуждаем идеи",
  duration: 30,
};

const validGuest = {
  guestName: "Гость",
  guestEmail: "guest@example.com",
};

// "Сейчас" зафиксировано на 09:47 — ближайшая точка сетки :00/:30 впереди это 10:00.
const bookingTime = new Date("2024-01-10T09:47:00.000Z");
const firstSlot = "2024-01-10T10:00:00.000Z";

function meetingsUrl(ownerEmail = owner): string {
  return `/api/owners/${encodeURIComponent(ownerEmail)}/meetings`;
}

function eventTypesUrlFor(ownerEmail: string): string {
  return `/api/owners/${encodeURIComponent(ownerEmail)}/event-types`;
}

// clock, подвижный после создания приложения: нужен, чтобы забронировать
// относительно одного "сейчас" и затем проверить список относительно другого.
function buildAppWithClock(initial: Date) {
  let current = initial;
  const clock = () => current;
  const setClock = (next: Date) => {
    current = next;
  };
  return { appPromise: buildApp({ dbPath: ":memory:", clock }), setClock };
}

async function createEventType(
  app: Awaited<ReturnType<typeof buildApp>>,
  ownerEmail = owner,
) {
  const res = await app.inject({
    method: "POST",
    url: eventTypesUrlFor(ownerEmail),
    payload: validEventType,
  });
  return res.json().id as number;
}

async function book(
  app: Awaited<ReturnType<typeof buildApp>>,
  eventTypeId: number,
  start: string,
  guest = validGuest,
  ownerEmail = owner,
) {
  const res = await app.inject({
    method: "POST",
    url: `${eventTypesUrlFor(ownerEmail)}/${eventTypeId}/bookings`,
    payload: { ...guest, start },
  });
  return res.json();
}

describe("GET /api/owners/:ownerEmail/meetings", () => {
  it("сценарий: бронь из гостевого флоу появляется в списке встреч владельца", async () => {
    const { appPromise } = buildAppWithClock(bookingTime);
    const app = await appPromise;
    const eventTypeId = await createEventType(app);
    const booking = await book(app, eventTypeId, firstSlot);

    const res = await app.inject({ method: "GET", url: meetingsUrl() });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
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

  it("включает идущую сейчас встречу (start в прошлом, end ещё не наступил)", async () => {
    const { appPromise, setClock } = buildAppWithClock(bookingTime);
    const app = await appPromise;
    const eventTypeId = await createEventType(app);
    await book(app, eventTypeId, firstSlot); // [10:00, 10:30)

    setClock(new Date("2024-01-10T10:15:00.000Z")); // встреча идёт прямо сейчас
    const res = await app.inject({ method: "GET", url: meetingsUrl() });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].end).toBe("2024-01-10T10:30:00.000Z");

    await app.close();
  });

  it("не включает завершившуюся встречу", async () => {
    const { appPromise, setClock } = buildAppWithClock(bookingTime);
    const app = await appPromise;
    const eventTypeId = await createEventType(app);
    await book(app, eventTypeId, firstSlot); // ends 10:30

    setClock(new Date("2024-01-10T11:00:00.000Z")); // встреча уже закончилась
    const res = await app.inject({ method: "GET", url: meetingsUrl() });

    expect(res.json()).toEqual([]);

    await app.close();
  });

  it("сортирует по возрастанию start", async () => {
    const { appPromise } = buildAppWithClock(bookingTime);
    const app = await appPromise;
    const eventTypeId = await createEventType(app);
    const later = await book(app, eventTypeId, "2024-01-10T12:00:00.000Z");
    const earlier = await book(app, eventTypeId, firstSlot);

    const res = await app.inject({ method: "GET", url: meetingsUrl() });

    expect(res.json().map((m: { id: number }) => m.id)).toEqual([
      earlier.id,
      later.id,
    ]);

    await app.close();
  });

  it("отдаёт только встречи этого владельца", async () => {
    const { appPromise } = buildAppWithClock(bookingTime);
    const app = await appPromise;
    const eventTypeId = await createEventType(app);
    await book(app, eventTypeId, firstSlot);

    const otherOwner = "other@example.com";
    const otherEventTypeId = await createEventType(app, otherOwner);
    await book(app, otherEventTypeId, firstSlot, validGuest, otherOwner);

    const res = await app.inject({ method: "GET", url: meetingsUrl() });

    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].ownerEmail).toBe(owner);

    await app.close();
  });

  it("пустой список для владельца без встреч", async () => {
    const { appPromise } = buildAppWithClock(bookingTime);
    const app = await appPromise;
    await createEventType(app);

    const res = await app.inject({ method: "GET", url: meetingsUrl() });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);

    await app.close();
  });
});
