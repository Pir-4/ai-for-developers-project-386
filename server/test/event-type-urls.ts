import type { FastifyInstance } from "fastify";

// Тесты слотов и броней адресуют лестницу через тип встречи. Все типы длятся
// 30 минут, поэтому большинству тестов хватает одного: он создаётся по первому
// обращению и переиспользуется в пределах одного приложения. Тестам, которым
// нужно несколько типов (общая занятость), — createEventType.
const defaults = new WeakMap<FastifyInstance, number>();

export async function createEventType(
  app: FastifyInstance,
  name = "Встреча",
): Promise<number> {
  const response = await app.inject({
    method: "POST",
    url: "/api/event-types",
    payload: { name, description: "Тестовый тип встречи" },
  });
  if (response.statusCode !== 201) {
    throw new Error(`cannot create event type: ${response.statusCode} ${response.body}`);
  }
  return (response.json() as { id: number }).id;
}

export async function eventTypeId(app: FastifyInstance): Promise<number> {
  const known = defaults.get(app);
  if (known !== undefined) return known;
  const id = await createEventType(app);
  defaults.set(app, id);
  return id;
}

export const slotsUrlOf = (id: number) => `/api/event-types/${id}/slots`;
export const bookingsUrlOf = (id: number) => `/api/event-types/${id}/bookings`;

/** URL-ы лестницы и брони типа встречи по умолчанию. */
export const slotsUrl = async (app: FastifyInstance) => slotsUrlOf(await eventTypeId(app));
export const bookingsUrl = async (app: FastifyInstance) =>
  bookingsUrlOf(await eventTypeId(app));
