import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const owner = "owner@example.com";
const eventTypesUrl = `/api/owners/${encodeURIComponent(owner)}/event-types`;

const validBody = {
  name: "Знакомство",
  description: "Первый созвон: знакомимся и обсуждаем идеи",
  durationMinutes: 30,
};

describe("POST /api/owners/:ownerEmail/event-types", () => {
  it("создаёт тип встречи и отдаёт 201 с серверным id и ownerEmail", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const res = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validBody,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.any(Number),
      ownerEmail: owner,
      ...validBody,
    });

    await app.close();
  });

  it("сценарий: созданный тип сохраняется в базе и доступен через GET", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const created = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validBody,
    });
    const { id } = created.json();

    const list = await app.inject({
      method: "GET",
      url: eventTypesUrl,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([
      {
        id,
        ownerEmail: owner,
        ...validBody,
      },
    ]);

    await app.close();
  });

  it("отдаёт пустой список другому владельцу", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    await app.inject({ method: "POST", url: eventTypesUrl, payload: validBody });

    const other = await app.inject({
      method: "GET",
      url: "/api/owners/other@example.com/event-types",
    });

    expect(other.statusCode).toBe(200);
    expect(other.json()).toEqual([]);

    await app.close();
  });

  it.each([
    {
      what: "длительность не кратна 15",
      payload: { ...validBody, durationMinutes: 7 },
      path: "durationMinutes",
    },
    {
      what: "длительность меньше 15",
      payload: { ...validBody, durationMinutes: 0 },
      path: "durationMinutes",
    },
    {
      what: "длительность больше 240",
      payload: { ...validBody, durationMinutes: 255 },
      path: "durationMinutes",
    },
    {
      what: "длительность — не число",
      payload: { ...validBody, durationMinutes: "30 минут" },
      path: "durationMinutes",
    },
    {
      what: "пустое название",
      payload: { ...validBody, name: "" },
      path: "name",
    },
    {
      what: "название длиннее 100 символов",
      payload: { ...validBody, name: "а".repeat(101) },
      path: "name",
    },
    {
      what: "пустое описание",
      payload: { ...validBody, description: "" },
      path: "description",
    },
    {
      what: "название из одних пробелов",
      payload: { ...validBody, name: "   " },
      path: "name",
    },
    {
      what: "описание из одних пробелов",
      payload: { ...validBody, description: " \t " },
      path: "description",
    },
    {
      what: "нет поля durationMinutes",
      payload: { name: validBody.name, description: validBody.description },
      path: "",
    },
  ])("отвечает 422, если $what", async ({ payload, path }) => {
    const app = await buildApp({ dbPath: ":memory:" });
    const res = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload,
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(typeof body.message).toBe("string");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path, message: expect.any(String) }),
      ]),
    );

    // ничего не создали
    const list = await app.inject({ method: "GET", url: eventTypesUrl });
    expect(list.json()).toEqual([]);

    await app.close();
  });
});

describe("обрезка пробелов при создании типа", () => {
  it("хранит название и описание без пробелов по краям", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const res = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: { ...validBody, name: "  Знакомство ", description: " Первый созвон  " },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Знакомство", description: "Первый созвон" });
    await app.close();
  });
});

describe("GET /api/owners/:ownerEmail/event-types/:eventTypeId", () => {
  it("отдаёт тип встречи владельца", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const { id } = (
      await app.inject({ method: "POST", url: eventTypesUrl, payload: validBody })
    ).json();

    const res = await app.inject({ method: "GET", url: `${eventTypesUrl}/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id, ownerEmail: owner, ...validBody });

    await app.close();
  });

  it("404 на неизвестный id и на тип другого владельца", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const { id } = (
      await app.inject({ method: "POST", url: eventTypesUrl, payload: validBody })
    ).json();

    for (const url of [
      `${eventTypesUrl}/999`,
      `/api/owners/other%40example.com/event-types/${id}`,
    ]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toHaveProperty("message");
    }

    await app.close();
  });
});
