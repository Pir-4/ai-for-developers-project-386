// The slot ladder: given an owner's availability intervals and a requested
// duration, which concrete meetings can a guest still book?
//
// Deliberately pure — no database, no Fastify, no HTTP, no ISO parsing of its
// own inputs. Everything is epoch milliseconds, so the arithmetic can be tested
// without standing up a server (see server/test/slot-ladder.test.ts).

/** The booking window, in days from today. */
export const WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The 15-minute grid every availability bound must land on. */
export const GRID_STEP_MS = 15 * 60 * 1000;

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
 * Lay cells of `durationMinutes` end to end from the start of each interval.
 *
 * A trailing remainder that does not fit is dropped (11:00–15:00 at 45 minutes
 * ends at 14:45, discarding the last quarter hour), cells never span two
 * intervals, and cells that have already started are omitted entirely — they
 * are not returned as busy or disabled, they simply are not offered.
 *
 * Cells come back ordered by start, whatever order the intervals arrived in.
 */
export function buildLadder(options: {
  intervals: Span[];
  durationMinutes: number;
  now: number;
  bookings: Span[];
}): Cell[] {
  const { intervals, durationMinutes, now, bookings } = options;
  const durationMs = durationMinutes * 60 * 1000;
  if (durationMs <= 0) return [];

  const cells: Cell[] = [];
  for (const interval of intervals) {
    for (
      let start = interval.start;
      start + durationMs <= interval.end;
      start += durationMs
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

/**
 * Whether a date key is close enough to today to belong to the booking window.
 *
 * Padded by a day on each side: the key is the *owner's* local date, and the
 * server does not know their offset, so a strict UTC comparison would reject
 * perfectly good edge days. The padding rejects absurd dates without
 * adjudicating cases the server has no information about.
 */
export function dateKeyInWindow(dateKey: string, now: number): boolean {
  const todayMs = Date.parse(`${utcDateKey(now)}T00:00:00.000Z`);
  return (
    dateKey >= utcDateKey(todayMs - DAY_MS) &&
    dateKey <= utcDateKey(todayMs + (WINDOW_DAYS + 1) * DAY_MS)
  );
}
