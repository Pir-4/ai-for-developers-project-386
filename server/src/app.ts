import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import fastifyStatic from "@fastify/static";
import openapiGlue from "fastify-openapi-glue";
import openapiSpec from "./generated/openapi.json" with { type: "json" };
import { openDatabase } from "./db/index.js";
import { createServiceHandlers } from "./services/index.js";

// Из server/src и server/dist путь одинаково указывает на <repo>/web/dist.
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));

export interface BuildAppOptions {
  /** Файл SQLite-базы. По умолчанию `<repo>/data/app.db`; тесты передают `":memory:"`. */
  dbPath?: string;
  /**
   * Уже открытая БД — вместо открытия по `dbPath`. Нужна тестам, которым
   * негде иначе завести фикстуры (например, бронь) до появления создающего
   * эндпоинта; владение (закрытие при `onClose`) переходит к `buildApp`.
   */
  db?: DatabaseSync;
  /** Текущий момент. По умолчанию системное время; тесты передают фиксированный. */
  clock?: () => Date;
}

// Ошибка валидации запроса (Ajv через fastify-openapi-glue) → 422 в форме ValidationError из контракта.
type AjvIssue = { instancePath?: string; message?: string };

function validationErrorHandler(
  error: Error & { validation?: AjvIssue[]; statusCode?: number },
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  const issues = error.validation ?? [];
  if (issues.length > 0) {
    reply.code(422).send({
      message: error.message,
      errors: issues.map((issue) => ({
        path: (issue.instancePath ?? "").replace(/^\//, ""),
        message: issue.message ?? "invalid value",
      })),
    });
    return;
  }

  reply.code(error.statusCode ?? 500).send({ message: error.message });
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // SQLite: база открывается и мигрируется на старте, провал — провал старта.
  const db = options.db ?? openDatabase(options.dbPath);
  app.addHook("onClose", async () => db.close());

  const clock = options.clock ?? (() => new Date());

  app.setErrorHandler(validationErrorHandler);

  // Роуты и валидация — из контракта (сгенерированная спека), хендлеры — services/.
  await app.register(openapiGlue, {
    specification: openapiSpec,
    serviceHandlers: createServiceHandlers(db, clock),
    prefix: "/api",
  });

  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: "/" });
    // Клиентские роуты (/login, /owner/…, /book/…) отдают index.html,
    // неизвестные /api/* остаются JSON 404.
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        reply.code(404).send({ message: "Not Found" });
        return;
      }
      if (request.method === "GET" || request.method === "HEAD") {
        reply.sendFile("index.html");
        return;
      }
      reply.code(404).send({ message: "Not Found" });
    });
  } else {
    app.log.warn(`Каталог статики не найден, пропускаю: ${webDist}`);
  }

  return app;
}
