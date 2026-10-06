import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";

// .sql migrations live next to this module (server/src/db/migrations, copied to
// dist/db/migrations by the build). Files are named NNN_description.sql and run
// in ascending order; PRAGMA user_version tracks how far the database is.
const migrationsDir = fileURLToPath(new URL("./migrations", import.meta.url));

type Migration = { version: number; file: string; sql: string };

function loadMigrations(): Migration[] {
  const files = readdirSync(migrationsDir)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();

  const migrations = files.map((file) => {
    const version = Number(file.match(/^(\d+)/)?.[1]);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`Не могу определить версию миграции: ${file}`);
    }
    return { version, file, sql: readFileSync(join(migrationsDir, file), "utf8") };
  });

  const versions = new Set(migrations.map((migration) => migration.version));
  if (versions.size !== migrations.length) {
    throw new Error("Дублирующиеся номера миграций в " + migrationsDir);
  }

  return migrations;
}

function readUserVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version;
}

/**
 * Applies every migration newer than the database's `user_version`, each with its
 * own version bump, all inside one transaction. Safe to run on every startup
 * (including every fresh `:memory:` test database); any failure rolls everything
 * back and propagates.
 */
export function runMigrations(db: DatabaseSync): void {
  const pending = loadMigrations().filter(
    (migration) => migration.version > readUserVersion(db),
  );
  if (pending.length === 0) return;

  db.exec("BEGIN");
  try {
    for (const migration of pending) {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
