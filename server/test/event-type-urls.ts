import type { FastifyInstance } from "fastify";

// Тесты слотов и броней адресуют лестницу через тип встречи. Чтобы не заводить
// типы вручную в каждом тесте, тип нужной длительности создаётся по первому
// обращению и переиспользуется в пределах одного приложения — значит, разные
// длительности в одном тесте это разные типы встречи одного владельца.
const created = new WeakMap<FastifyInstance, Map<string, number>>();

export async function eventTypeId(
  app: FastifyInstance,
  ownerEmail: string,
  durationMinutes: number,
): Promise<number> {
  const byKey = created.get(app) ?? new Map<string, number>();
  created.set(app, byKey);
  const key = `${ownerEmail}|${durationMinutes}`;
  const known = byKey.get(key);
  if (known !== undefined) return known;

  const response = await app.inject({
    method: "POST",
    url: `/api/owners/${encodeURIComponent(ownerEmail)}/event-types`,
    payload: {
      name: `Встреча ${durationMinutes} мин`,
      description: "Тестовый тип встречи",
      durationMinutes,
    },
  });
  if (response.statusCode !== 201) {
    throw new Error(`cannot create event type: ${response.statusCode} ${response.body}`);
  }
  const { id } = response.json() as { id: number };
  byKey.set(key, id);
  return id;
}

/** URL-ы лестницы и брони типа встречи заданной длительности у владельца. */
export function eventTypeUrls(ownerEmail: string) {
  const base = `/api/owners/${encodeURIComponent(ownerEmail)}/event-types`;
  return {
    slotsUrl: async (app: FastifyInstance, durationMinutes: number) =>
      `${base}/${await eventTypeId(app, ownerEmail, durationMinutes)}/slots`,
    bookingsUrl: async (app: FastifyInstance, durationMinutes: number) =>
      `${base}/${await eventTypeId(app, ownerEmail, durationMinutes)}/bookings`,
  };
}
