// Арифметика лестницы слотов — отдельный низкий шов: прошедшее × конец окна ×
// несколько интервалов × пересечение с бронями. Гонять это через HTTP значило
// бы писать каждый случай двумя подготовительными запросами.
import { describe, expect, it } from "vitest";
import {
  GRID_STEP_MS,
  buildLadder,
  dateKeyInWindow,
  hasSelfOverlap,
  isCovered,
  overlaps,
  windowEnd,
} from "../src/services/slot-ladder.js";

const at = (iso: string): number => Date.parse(iso);
const starts = (cells: { start: number }[]): string[] =>
  cells.map((cell) => new Date(cell.start).toISOString().slice(11, 16));

const day = "2024-01-11";
const morning = { start: at(`${day}T10:00:00.000Z`), end: at(`${day}T12:00:00.000Z`) };
const before = at("2024-01-10T09:47:00.000Z");
const farAway = at("2030-01-01T00:00:00.000Z");

const ladder = (options: {
  intervals: { start: number; end: number }[];
  now?: number;
  until?: number;
  bookings?: { start: number; end: number }[];
}) =>
  buildLadder({
    intervals: options.intervals,
    durationMinutes: 30,
    now: options.now ?? before,
    until: options.until ?? farAway,
    bookings: options.bookings ?? [],
  });

describe("buildLadder", () => {
  it("сетка 30 минут", () => {
    expect(GRID_STEP_MS).toBe(30 * 60 * 1000);
  });

  it("начинает слот на каждом шаге сетки от начала интервала", () => {
    const cells = ladder({ intervals: [morning] });
    expect(starts(cells)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
    expect(cells.every((cell) => cell.end - cell.start === 30 * 60 * 1000)).toBe(true);
  });

  it("шаг — сетка, а не длительность: длинная встреча начинается каждые 30 минут", () => {
    const cells = buildLadder({
      intervals: [morning],
      durationMinutes: 60,
      now: before,
      until: farAway,
      bookings: [],
    });
    // Ячейка должна целиком влезть в интервал: 11:30–12:30 уже не помещается.
    expect(starts(cells)).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("не перекидывает ячейку через разрыв между интервалами", () => {
    const cells = ladder({
      intervals: [
        { start: at(`${day}T10:00:00.000Z`), end: at(`${day}T11:00:00.000Z`) },
        { start: at(`${day}T13:00:00.000Z`), end: at(`${day}T14:00:00.000Z`) },
      ],
    });
    // Обед 11:00–13:00 реально разрывает лестницу.
    expect(starts(cells)).toEqual(["10:00", "10:30", "13:00", "13:30"]);
  });

  it("помечает занятыми ячейки, пересекающиеся с бронью", () => {
    const cells = ladder({
      intervals: [morning],
      bookings: [{ start: at(`${day}T10:30:00.000Z`), end: at(`${day}T11:00:00.000Z`) }],
    });
    expect(cells.map((cell) => cell.status)).toEqual(["free", "busy", "free", "free"]);
  });

  it("разрешает касание границ: бронь впритык не занимает соседнюю ячейку", () => {
    const cells = ladder({
      intervals: [morning],
      bookings: [{ start: at(`${day}T09:30:00.000Z`), end: at(`${day}T10:00:00.000Z`) }],
    });
    expect(cells[0]?.status).toBe("free");
  });

  it("совсем не возвращает ячейки, которые уже начались", () => {
    const cells = ladder({ intervals: [morning], now: at(`${day}T10:40:00.000Z`) });
    // 10:30 началась десятью минутами раньше — её нет ни как занятой, ни как
    // выключенной, её просто нет.
    expect(starts(cells)).toEqual(["11:00", "11:30"]);
  });

  it("не возвращает ячейки, начинающиеся в момент конца окна и позже", () => {
    const cells = ladder({ intervals: [morning], until: at(`${day}T11:00:00.000Z`) });
    expect(starts(cells)).toEqual(["10:00", "10:30"]);
  });

  it("возвращает ячейки по возрастанию, как бы ни пришли интервалы", () => {
    const cells = ladder({
      intervals: [
        { start: at(`${day}T16:00:00.000Z`), end: at(`${day}T17:00:00.000Z`) },
        { start: at(`${day}T11:00:00.000Z`), end: at(`${day}T12:00:00.000Z`) },
      ],
    });
    expect(starts(cells)).toEqual(["11:00", "11:30", "16:00", "16:30"]);
  });

  it("закрытый день не даёт ячеек", () => {
    expect(ladder({ intervals: [] })).toEqual([]);
  });
});

describe("окно бронирования", () => {
  const now = at("2024-01-10T09:47:00.000Z");

  it("dateKeyInWindow: ровно 14 дней вместе с сегодняшним", () => {
    expect(dateKeyInWindow("2024-01-10", now)).toBe(true);
    expect(dateKeyInWindow("2024-01-23", now)).toBe(true);
    expect(dateKeyInWindow("2024-01-24", now)).toBe(false);
    expect(dateKeyInWindow("2024-01-09", now)).toBe(false);
  });

  it("windowEnd: начало UTC-дня сегодня + 14", () => {
    expect(windowEnd(now)).toBe(at("2024-01-24T00:00:00.000Z"));
  });
});

describe("вспомогательные правила", () => {
  it("overlaps: полуоткрытые интервалы, касание разрешено", () => {
    const a = { start: 10, end: 20 };
    expect(overlaps(a, { start: 20, end: 30 })).toBe(false);
    expect(overlaps(a, { start: 19, end: 30 })).toBe(true);
  });

  it("isCovered: бронь внутри одного из интервалов", () => {
    const covers = [
      { start: 0, end: 10 },
      { start: 20, end: 40 },
    ];
    expect(isCovered({ start: 25, end: 35 }, covers)).toBe(true);
    // Частичное покрытие двумя интервалами не считается покрытием.
    expect(isCovered({ start: 5, end: 25 }, covers)).toBe(false);
  });

  it("hasSelfOverlap: пересечение интервалов одного дня", () => {
    expect(
      hasSelfOverlap([
        { start: 0, end: 10 },
        { start: 10, end: 20 },
      ]),
    ).toBe(false);
    expect(
      hasSelfOverlap([
        { start: 0, end: 11 },
        { start: 10, end: 20 },
      ]),
    ).toBe(true);
  });
});
