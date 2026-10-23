import type { components } from "./generated/schema.js";

export type Owner = components["schemas"]["Owner"];

/**
 * Единственный заранее заданный владелец календаря: профиль берётся из
 * окружения (OWNER_NAME, OWNER_EMAIL) и в базе не хранится — регистрации и
 * входа нет.
 */
export function ownerFromEnv(env: NodeJS.ProcessEnv = process.env): Owner {
  return {
    name: env.OWNER_NAME?.trim() || "Алексей Иванов",
    email: env.OWNER_EMAIL?.trim() || "owner@example.com",
  };
}
