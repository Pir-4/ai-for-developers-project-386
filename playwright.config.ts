import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// End-to-end: the production build (`npm run build`, done by `npm run test:e2e`)
// served by the single server process on a throwaway SQLite file, driven by a
// real browser — the whole booking path through the UI.
const port = 8123;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node server/dist/index.js",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    env: {
      PORT: String(port),
      DB_PATH: join(tmpdir(), `call-booking-e2e-${Date.now()}.db`),
    },
  },
});
