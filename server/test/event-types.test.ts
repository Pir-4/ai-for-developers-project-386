import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const eventTypesUrl = "/api/event-types";

const validBody = {
  name: "Знакомство",
  description: "Первый созвон: знакомимся и обсуждаем идеи",
};

describe("POST /api/event-types", () => {
  it("создаёт тип встречи и отдаёт 201 с серверным id и длительностью 30 минут", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const res = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: validBody,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.any(Number),
      ...validBody,
      durationMinutes: 30,
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
    expect(list.json()).toEqual([{ id, ...validBody, durationMinutes: 30 }]);

    await app.close();
  });

  it("длительность из тела запроса игнорируется: все встречи по 30 минут", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const res = await app.inject({
      method: "POST",
      url: eventTypesUrl,
      payload: { ...validBody, durationMinutes: 90 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().durationMinutes).toBe(30);

    await app.close();
  });

  it.each([
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
      what: "нет поля description",
      payload: { name: validBody.name },
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
      payload: { name: "  Знакомство ", description: " Первый созвон  " },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Знакомство", description: "Первый созвон" });
    await app.close();
  });
});

describe("GET /api/event-types/:eventTypeId", () => {
  it("отдаёт тип встречи", async () => {
    const app = await buildApp({ dbPath: ":memory:" });
    const { id } = (
      await app.inject({ method: "POST", url: eventTypesUrl, payload: validBody })
    ).json();

    const res = await app.inject({ method: "GET", url: `${eventTypesUrl}/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id, ...validBody, durationMinutes: 30 });

    await app.close();
  });

  it("404 на неизвестный id", async () => {
    const app = await buildApp({ dbPath: ":memory:" });

    const res = await app.inject({ method: "GET", url: `${eventTypesUrl}/999` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("message");

    await app.close();
  });
});
