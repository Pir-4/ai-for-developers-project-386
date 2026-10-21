import { rmSync } from "node:fs";

// Removes the run's throwaway SQLite database (and its WAL/SHM companions).
export default function globalTeardown() {
  const dbPath = process.env.E2E_DB_PATH;
  if (!dbPath) return;
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${dbPath}${suffix}`, { force: true });
  }
}
