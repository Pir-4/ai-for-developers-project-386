import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { ownerFromEnv } from "../src/owner.js";

describe("GET /api/owner", () => {
  it("отдаёт профиль единственного владельца, переданный в buildApp", async () => {
    const owner = { name: "Мария Петрова", email: "maria@example.com" };
    const app = await buildApp({ dbPath: ":memory:", owner });

    const response = await app.inject({ method: "GET", url: "/api/owner" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(owner);

    await app.close();
  });

  it("по умолчанию берёт владельца из окружения", async () => {
    const app = await buildApp({ dbPath: ":memory:" });

    const response = await app.inject({ method: "GET", url: "/api/owner" });
    expect(response.json()).toEqual(ownerFromEnv());

    await app.close();
  });
});

describe("ownerFromEnv", () => {
  it("читает OWNER_NAME и OWNER_EMAIL, обрезая пробелы", () => {
    expect(
      ownerFromEnv({ OWNER_NAME: " Мария Петрова ", OWNER_EMAIL: "maria@example.com " }),
    ).toEqual({ name: "Мария Петрова", email: "maria@example.com" });
  });

  it("без переменных или с пустыми — демо-владелец по умолчанию", () => {
    const fallback = { name: "Алексей Иванов", email: "owner@example.com" };
    expect(ownerFromEnv({})).toEqual(fallback);
    expect(ownerFromEnv({ OWNER_NAME: "  ", OWNER_EMAIL: "" })).toEqual(fallback);
  });
});
