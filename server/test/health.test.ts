import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /api/health", () => {
  it("отвечает 200 и статусом ok", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");

    await app.close();
  });
});
