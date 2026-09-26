import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

// Из server/src и server/dist путь одинаково указывает на <repo>/web/dist.
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.get("/api/health", async () => ({ status: "ok" }));

  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: "/" });
  } else {
    app.log.warn(`Каталог статики не найден, пропускаю: ${webDist}`);
  }

  return app;
}
