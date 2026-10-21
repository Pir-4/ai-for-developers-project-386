import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// End-to-end: the production build (`npm run build`, done by `npm run test:e2e`)
// served by the single server process on a throwaway SQLite file, driven by a
// real browser — the whole booking path through the UI. E2E_BASE_URL points the
// suite at an already running instance instead (e.g. the Docker image) and
// skips starting a server.
const port = 8123;
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? `http://localhost:${port}`;

// One throwaway database per run. Pinned in the environment so the worker
// processes (which re-evaluate this config) and e2e/global-teardown.ts, which
// deletes it afterwards, all agree on the path.
process.env.E2E_DB_PATH ??= join(tmpdir(), `call-booking-e2e-${process.pid}.db`);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  globalTeardown: "./e2e/global-teardown.ts",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        command: "node server/dist/index.js",
        url: `${baseURL}/api/health`,
        reuseExistingServer: false,
        env: {
          PORT: String(port),
          DB_PATH: process.env.E2E_DB_PATH,
        },
      },
});
