import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import openapiGlue from "fastify-openapi-glue";
import openapiSpec from "./generated/openapi.json" with { type: "json" };
import { serviceHandlers } from "./services/index.js";

// Из server/src и server/dist путь одинаково указывает на <repo>/web/dist.
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Роуты и валидация — из контракта (сгенерированная спека), хендлеры — services/.
  await app.register(openapiGlue, {
    specification: openapiSpec,
    serviceHandlers,
    prefix: "/api",
  });

  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: "/" });
  } else {
    app.log.warn(`Каталог статики не найден, пропускаю: ${webDist}`);
  }

  return app;
}
