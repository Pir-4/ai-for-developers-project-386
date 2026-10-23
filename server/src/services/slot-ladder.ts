// The slot ladder: given an owner's availability intervals and a requested
// duration, which concrete meetings can a guest still book?
//
// Deliberately pure — no database, no Fastify, no HTTP, no ISO parsing of its
// own inputs. Everything is epoch milliseconds, so the arithmetic can be tested
// without standing up a server (see server/test/slot-ladder.test.ts).

/** The booking window: today and the next 13 days, 14 days in all. */
export const WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The 30-minute grid every availability bound and every slot start lands on. */
export const GRID_STEP_MS = 30 * 60 * 1000;

/** The length of every slot and every booking, in minutes. */
export const SLOT_MINUTES = 30;

export interface Span {
  /** Inclusive start, epoch ms. */
  start: number;
  /** Exclusive end, epoch ms. */
  end: number;
}

export type SlotStatus = "free" | "busy";

export interface Cell extends Span {
  status: SlotStatus;
}

/**
 * Half-open intersection: `[start, end)` against `[start, end)`.
 * Touching boundaries do not conflict — 10:00–11:00 and 11:00–11:30 coexist.
 */
export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Whether `span` is entirely inside at least one of `covers`. */
export function isCovered(span: Span, covers: Span[]): boolean {
  return covers.some((cover) => cover.start <= span.start && span.end <= cover.end);
}

/** Whether any two of `spans` intersect each other. */
export function hasSelfOverlap(spans: Span[]): boolean {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  return sorted.some((span, index) => index > 0 && span.start < sorted[index - 1]!.end);
}

/**
 * Cells of `durationMinutes`, one starting at every grid step from the start of
 * each interval (10:00–12:00 at 30 minutes gives 10:00, 10:30, 11:00, 11:30).
 *
 * A cell must end inside its interval, so cells never span two intervals.
 * Cells that have already started, or that start at or after `until` (the end
 * of the booking window), are omitted entirely — they are not returned as busy
 * or disabled, they simply are not offered.
 *
 * Cells come back ordered by start, whatever order the intervals arrived in.
 */
export function buildLadder(options: {
  intervals: Span[];
  durationMinutes: number;
  now: number;
  until: number;
  bookings: Span[];
}): Cell[] {
  const { intervals, durationMinutes, now, until, bookings } = options;
  const durationMs = durationMinutes * 60 * 1000;
  if (durationMs <= 0) return [];

  const cells: Cell[] = [];
  for (const interval of intervals) {
    for (
      let start = interval.start;
      start + durationMs <= interval.end && start < until;
      start += GRID_STEP_MS
    ) {
      if (start < now) continue;
      const cell = { start, end: start + durationMs };
      cells.push({
        ...cell,
        status: bookings.some((booking) => overlaps(cell, booking)) ? "busy" : "free",
      });
    }
  }
  return cells.sort((a, b) => a.start - b.start);
}

/** UTC day key (`YYYY-MM-DD`) of an instant. */
export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Start of the UTC day `now` falls on, epoch ms. */
function utcDayStart(now: number): number {
  return Date.parse(`${utcDateKey(now)}T00:00:00.000Z`);
}

/** The first instant past the booking window: the start of UTC day today + 14. */
export function windowEnd(now: number): number {
  return utcDayStart(now) + WINDOW_DAYS * DAY_MS;
}

/**
 * Whether a date key lies in the booking window: today … today + 13, UTC days,
 * exactly 14 days counting today.
 */
export function dateKeyInWindow(dateKey: string, now: number): boolean {
  const todayMs = utcDayStart(now);
  return (
    dateKey >= utcDateKey(todayMs) &&
    dateKey <= utcDateKey(todayMs + (WINDOW_DAYS - 1) * DAY_MS)
  );
}
