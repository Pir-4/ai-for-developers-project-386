import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./migrate.js";

// data/app.db в корне репозитория — и из src (dev), и из dist (prod) путь одинаковый.
const defaultDbPath = fileURLToPath(
  new URL("../../../data/app.db", import.meta.url),
);

/**
 * Открывает SQLite-базу и доводит её до актуальной схемы: миграции применяются
 * на каждом старте (см. runMigrations). Провал миграции — провал старта.
 *
 * @param dbPath файл базы; по умолчанию `<repo>/data/app.db`, тесты передают `":memory:"`.
 */
export function openDatabase(dbPath: string = defaultDbPath): DatabaseSync {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  runMigrations(db);
  return db;
}
