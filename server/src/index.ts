import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 8000);
const host = "0.0.0.0";

// DB_PATH — другой файл базы (e2e-тесты поднимают сервер на временной БД).
const app = await buildApp({ dbPath: process.env.DB_PATH });

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
