// Общие правила сетки и окна бронирования (used by slots.ts and bookings.ts).

export const GRID_STEP_MS = 30 * 60 * 1000;
export const WINDOW_DAYS = 14;

// Конец окна бронирования: полночь UTC текущих суток + 14 дней (граница не
// зависит от времени суток "сейчас" — проверяется только start, не end слота).
export function windowEnd(now: Date): Date {
  const todayUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(todayUtcMidnight + WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

// Ближайшая точка сетки :00/:30, которая >= now.
export function firstGridStart(now: Date): Date {
  const aligned = Math.ceil(now.getTime() / GRID_STEP_MS) * GRID_STEP_MS;
  return new Date(aligned);
}

// startMs лежит на сетке :00/:30.
export function isOnGrid(startMs: number): boolean {
  return startMs % GRID_STEP_MS === 0;
}

// Пересечение полуоткрытых интервалов [start, end) — касание границ разрешено.
export function overlapsAny(
  startMs: number,
  endMs: number,
  bookings: { start: string; end: string }[],
): boolean {
  return bookings.some((booking) => {
    const bookingStart = Date.parse(booking.start);
    const bookingEnd = Date.parse(booking.end);
    return startMs < bookingEnd && bookingStart < endMs;
  });
}
