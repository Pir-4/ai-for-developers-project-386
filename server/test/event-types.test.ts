import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const owner = "owner@example.com";
const eventTypesUrl = `/api/owners/${encodeURIComponent(owner)}/event-types`;

const validBody = {
  name: "Знакомство",
  description: "Первый созвон: знакомимся и обсуждаем идеи",
  duration: 30,
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
      payload: { ...validBody, duration: 7 },
      path: "duration",
    },
    {
      what: "длительность меньше 15",
      payload: { ...validBody, duration: 0 },
      path: "duration",
    },
    {
      what: "длительность больше 240",
      payload: { ...validBody, duration: 255 },
      path: "duration",
    },
    {
      what: "длительность — не число",
      payload: { ...validBody, duration: "30 минут" },
      path: "duration",
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
      what: "нет поля duration",
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
