// Арифметика лестницы слотов — отдельный низкий шов (см. spec #40, Testing
// Decisions). Комбинаторика здесь настоящая: хвост × прошедшее × несколько
// интервалов × три длительности × пересечение с бронями, и гонять её через
// HTTP значило бы писать каждый случай двумя подготовительными запросами.
import { describe, expect, it } from "vitest";
import {
  buildLadder,
  dateKeyInWindow,
  hasSelfOverlap,
  isCovered,
  overlaps,
} from "../src/services/slot-ladder.js";

const at = (iso: string): number => Date.parse(iso);
const starts = (cells: { start: number }[]): string[] =>
  cells.map((cell) => new Date(cell.start).toISOString().slice(11, 16));

const day = "2024-01-11";
const morning = { start: at(`${day}T11:00:00.000Z`), end: at(`${day}T15:00:00.000Z`) };
const before = at("2024-01-10T09:47:00.000Z");

describe("buildLadder", () => {
  it("укладывает ячейки встык от начала интервала", () => {
    const cells = buildLadder({
      intervals: [morning],
      durationMinutes: 45,
      now: before,
      bookings: [],
    });
    expect(starts(cells)).toEqual(["11:00", "11:45", "12:30", "13:15", "14:00"]);
  });

  it("отбрасывает хвост, который не влезает целиком", () => {
    const cells = buildLadder({
      intervals: [morning],
      durationMinutes: 45,
      now: before,
      bookings: [],
    });
    // 14:45–15:00 — пятнадцать минут, в 45-минутную встречу не превращаются.
    expect(cells.at(-1)?.end).toBe(at(`${day}T14:45:00.000Z`));
  });

  it("даёт разную лестницу для разных длительностей", () => {
    const counts = [15, 30, 45].map(
      (durationMinutes) =>
        buildLadder({ intervals: [morning], durationMinutes, now: before, bookings: [] })
          .length,
    );
    expect(counts).toEqual([16, 8, 5]);
  });

  it("не перекидывает ячейку через разрыв между интервалами", () => {
    const cells = buildLadder({
      intervals: [
        { start: at(`${day}T11:00:00.000Z`), end: at(`${day}T13:00:00.000Z`) },
        { start: at(`${day}T14:00:00.000Z`), end: at(`${day}T18:00:00.000Z`) },
      ],
      durationMinutes: 45,
      now: before,
      bookings: [],
    });
    // Обед 13:00–14:00 реально разрывает лестницу: 12:30–13:15 не существует.
    expect(starts(cells)).toEqual([
      "11:00",
      "11:45",
      "14:00",
      "14:45",
      "15:30",
      "16:15",
      "17:00",
    ]);
  });

  it("помечает занятыми ячейки, пересекающиеся с бронью", () => {
    const cells = buildLadder({
      intervals: [morning],
      durationMinutes: 45,
      now: before,
      bookings: [
        { start: at(`${day}T12:30:00.000Z`), end: at(`${day}T13:15:00.000Z`) },
      ],
    });
    expect(cells.map((cell) => cell.status)).toEqual([
      "free",
      "free",
      "busy",
      "free",
      "free",
    ]);
  });

  it("помечает занятой и ячейку другой длительности, если она задевает бронь", () => {
    const cells = buildLadder({
      intervals: [morning],
      durationMinutes: 15,
      now: before,
      bookings: [
        { start: at(`${day}T12:30:00.000Z`), end: at(`${day}T13:15:00.000Z`) },
      ],
    });
    const busy = cells.filter((cell) => cell.status === "busy");
    expect(starts(busy)).toEqual(["12:30", "12:45", "13:00"]);
  });

  it("разрешает касание границ: бронь впритык не занимает соседнюю ячейку", () => {
    const cells = buildLadder({
      intervals: [morning],
      durationMinutes: 45,
      now: before,
      bookings: [
        { start: at(`${day}T10:15:00.000Z`), end: at(`${day}T11:00:00.000Z`) },
      ],
    });
    expect(cells[0]?.status).toBe("free");
  });

  it("совсем не возвращает ячейки, которые уже начались", () => {
    const cells = buildLadder({
      intervals: [morning],
      durationMinutes: 45,
      now: at(`${day}T13:20:00.000Z`),
      bookings: [],
    });
    // 13:15 началась двадцатью минутами раньше — её нет ни как занятой, ни как
    // выключенной, её просто нет.
    expect(starts(cells)).toEqual(["14:00"]);
  });

  it("возвращает ячейки по возрастанию, как бы ни пришли интервалы", () => {
    const cells = buildLadder({
      intervals: [
        { start: at(`${day}T16:00:00.000Z`), end: at(`${day}T17:00:00.000Z`) },
        { start: at(`${day}T11:00:00.000Z`), end: at(`${day}T12:00:00.000Z`) },
      ],
      durationMinutes: 30,
      now: before,
      bookings: [],
    });
    expect(starts(cells)).toEqual(["11:00", "11:30", "16:00", "16:30"]);
  });

  it("закрытый день не даёт ячеек", () => {
    expect(
      buildLadder({ intervals: [], durationMinutes: 30, now: before, bookings: [] }),
    ).toEqual([]);
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

  it("dateKeyInWindow: окно с запасом в сутки на незнание пояса владельца", () => {
    const now = at("2024-01-10T09:47:00.000Z");
    expect(dateKeyInWindow("2024-01-10", now)).toBe(true);
    expect(dateKeyInWindow("2024-01-24", now)).toBe(true);
    expect(dateKeyInWindow("2024-01-09", now)).toBe(true);
    expect(dateKeyInWindow("2024-01-08", now)).toBe(false);
    expect(dateKeyInWindow("2024-01-26", now)).toBe(false);
  });
});
