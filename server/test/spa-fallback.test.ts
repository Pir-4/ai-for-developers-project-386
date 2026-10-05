import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

// SPA-fallback работает только при собранном web/dist: npm run build.
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));

describe("SPA fallback", () => {
  it("неизвестный /api/* остаётся JSON 404", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const res = await app.inject({ method: "GET", url: "/api/no-such-op" });

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toEqual(expect.any(String));

    await app.close();
  });

  describe.skipIf(!existsSync(webDist))("web/dist собран", () => {
    it("клиентские роуты отдают index.html", async () => {
      const app = await buildApp({ dbPath: ":memory:" });
      for (const url of ["/login", "/owner", "/owner/a@b.co", "/book/a@b.co/1"]) {
        const res = await app.inject({ method: "GET", url });
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toContain("text/html");
      }

      await app.close();
    });
  });
});
