import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";

type NotFoundError = components["schemas"]["NotFoundError"];

const GRID_STEP_MS = 30 * 60 * 1000;
const WINDOW_DAYS = 14;

type EventTypeRow = { duration: number };
type BookingRow = { start: string; end: string };

// Конец окна бронирования: полночь UTC текущих суток + 14 дней (граница не
// зависит от времени суток "сейчас" — проверяется только start, не end слота).
function windowEnd(now: Date): Date {
  const todayUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(todayUtcMidnight + WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

// Ближайшая точка сетки :00/:30, которая >= now.
function firstGridStart(now: Date): Date {
  const aligned = Math.ceil(now.getTime() / GRID_STEP_MS) * GRID_STEP_MS;
  return new Date(aligned);
}

// Пересечение полуоткрытых интервалов [start, end) — касание границ разрешено.
function overlapsAny(
  startMs: number,
  endMs: number,
  bookings: BookingRow[],
): boolean {
  return bookings.some((booking) => {
    const bookingStart = Date.parse(booking.start);
    const bookingEnd = Date.parse(booking.end);
    return startMs < bookingEnd && bookingStart < endMs;
  });
}

/** GET /api/owners/:ownerEmail/event-types/:id/slots — свободные начала слотов. */
export function createListSlotsHandler(db: DatabaseSync, clock: () => Date) {
  const findEventType = db.prepare(
    "SELECT duration FROM event_types WHERE id = ? AND owner_email = ?",
  );
  // Занятость общая для всех типов встреч владельца — выбираем все его брони.
  const selectBookings = db.prepare(
    "SELECT start, end FROM bookings WHERE owner_email = ?",
  );

  return async (
    request: FastifyRequest<{ Params: { ownerEmail: string; id: string } }>,
    reply: FastifyReply,
  ): Promise<string[] | NotFoundError> => {
    const { ownerEmail, id } = request.params;
    const eventType = findEventType.get(Number(id), ownerEmail) as
      | EventTypeRow
      | undefined;
    if (!eventType) {
      reply.code(404);
      return { message: "event type not found" };
    }

    const now = clock();
    const end = windowEnd(now);
    const durationMs = eventType.duration * 60 * 1000;
    const bookings = selectBookings.all(ownerEmail) as BookingRow[];

    const slots: string[] = [];
    for (
      let start = firstGridStart(now).getTime();
      start < end.getTime();
      start += GRID_STEP_MS
    ) {
      if (!overlapsAny(start, start + durationMs, bookings)) {
        slots.push(new Date(start).toISOString());
      }
    }
    return slots;
  };
}
