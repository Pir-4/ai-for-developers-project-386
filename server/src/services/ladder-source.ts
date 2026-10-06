import type { DatabaseSync } from "node:sqlite";
import { buildLadder, dateKeyInWindow, type Cell, type Span } from "./slot-ladder.js";

type IntervalRow = { date: string; start: string; end: string };
type BookingRow = { start: string; end: string };

function toSpan(row: { start: string; end: string }): Span {
  return { start: Date.parse(row.start), end: Date.parse(row.end) };
}

/**
 * Собирает лестницу слотов владельца из БД: доступность за окно минус его брони.
 * Общий источник для выдачи слотов и для проверки при бронировании — чтобы
 * гость не мог забронировать то, чего ему не показывали.
 */
export function createLadderLoader(db: DatabaseSync) {
  const selectAvailability = db.prepare(
    "SELECT date, start, end FROM availability WHERE owner_email = ?",
  );
  const selectBookings = db.prepare(
    "SELECT start, end FROM bookings WHERE owner_email = ?",
  );

  return function loadLadder(
    ownerEmail: string,
    durationMinutes: number,
    now: number,
  ): { hasAvailability: boolean; cells: Cell[] } {
    const rows = (selectAvailability.all(ownerEmail) as IntervalRow[]).filter((row) =>
      dateKeyInWindow(row.date, now),
    );
    const bookings = (selectBookings.all(ownerEmail) as BookingRow[]).map(toSpan);
    return {
      hasAvailability: rows.length > 0,
      cells: buildLadder({
        intervals: rows.map(toSpan),
        durationMinutes,
        now,
        bookings,
      }),
    };
  };
}
