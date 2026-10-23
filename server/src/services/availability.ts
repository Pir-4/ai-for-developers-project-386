import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";
import {
  GRID_STEP_MS,
  dateKeyInWindow,
  hasSelfOverlap,
  isCovered,
  overlaps,
  type Span,
} from "./slot-ladder.js";

type DayAvailability = components["schemas"]["DayAvailability"];
type SetAvailabilityBody = components["schemas"]["SetAvailabilityBody"];
type ValidationError = components["schemas"]["ValidationError"];
type AvailabilityConflictError = components["schemas"]["AvailabilityConflictError"];

type IntervalRow = { date: string; start: string; end: string };
type BookingRow = { start: string; end: string; guest_name: string };

function invalid(path: string, message: string): ValidationError {
  return { message: "invalid availability", errors: [{ path, message }] };
}

function toSpan(interval: { start: string; end: string }): Span {
  return { start: Date.parse(interval.start), end: Date.parse(interval.end) };
}

/** PUT /api/availability/:date — заменяет доступность дня целиком. */
export function createSetAvailabilityHandler(db: DatabaseSync, clock: () => Date) {
  const selectDay = db.prepare(
    "SELECT date, start, end FROM availability WHERE date = ? ORDER BY start",
  );
  const selectBookings = db.prepare(
    "SELECT start, end, guest_name FROM bookings",
  );
  const deleteDay = db.prepare(
    "DELETE FROM availability WHERE date = ?",
  );
  const insert = db.prepare(
    "INSERT INTO availability (date, start, end) VALUES (?, ?, ?)",
  );

  return async (
    request: FastifyRequest<{
      Params: { date: string };
      Body: SetAvailabilityBody;
    }>,
    reply: FastifyReply,
  ): Promise<DayAvailability | ValidationError | AvailabilityConflictError> => {
    const { date } = request.params;
    const now = clock().getTime();

    if (!dateKeyInWindow(date, now)) {
      reply.code(422);
      return invalid("date", "must be within the booking window");
    }

    const intervals = request.body.intervals;
    for (const [index, interval] of intervals.entries()) {
      const span = toSpan(interval);
      if (!(span.end > span.start)) {
        reply.code(422);
        return invalid(`intervals/${index}/end`, "must be after start");
      }
      if (span.start % GRID_STEP_MS !== 0 || span.end % GRID_STEP_MS !== 0) {
        reply.code(422);
        return invalid(`intervals/${index}`, "must lie on the 30-minute grid");
      }
    }
    const spans = intervals.map(toSpan);
    if (hasSelfOverlap(spans)) {
      reply.code(422);
      return invalid("intervals", "must not overlap each other");
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      // Какие брони «держит» этот день — те, что лежали внутри его прежних
      // интервалов. Ключ даты для сервера непрозрачен, поэтому принадлежность
      // брони дню определяется пересечением, а не разбором даты.
      const previous = (selectDay.all(date) as IntervalRow[]).map(toSpan);
      const held = (selectBookings.all() as BookingRow[]).filter((booking) =>
        previous.some((span) => overlaps(toSpan(booking), span)),
      );
      const uncovered = held.filter((booking) => !isCovered(toSpan(booking), spans));
      if (uncovered.length > 0) {
        db.exec("ROLLBACK");
        reply.code(409);
        return {
          message: "availability cannot be withdrawn from under a booking",
          meetings: uncovered.map((booking) => ({
            start: booking.start,
            end: booking.end,
            guestName: booking.guest_name,
          })),
        };
      }

      deleteDay.run(date);
      for (const interval of intervals) {
        insert.run(date, interval.start, interval.end);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    return {
      date,
      intervals: [...intervals].sort((a, b) => a.start.localeCompare(b.start)),
    };
  };
}

/** GET /api/availability — доступность за окно бронирования. */
export function createListAvailabilityHandler(db: DatabaseSync, clock: () => Date) {
  const selectAll = db.prepare(
    "SELECT date, start, end FROM availability ORDER BY date, start",
  );

  return async (): Promise<DayAvailability[]> => {
    const now = clock().getTime();
    const rows = (selectAll.all() as IntervalRow[]).filter(
      (row) => dateKeyInWindow(row.date, now),
    );

    const byDate = new Map<string, DayAvailability>();
    for (const row of rows) {
      const day = byDate.get(row.date) ?? { date: row.date, intervals: [] };
      day.intervals.push({ start: row.start, end: row.end });
      byDate.set(row.date, day);
    }
    return [...byDate.values()];
  };
}
