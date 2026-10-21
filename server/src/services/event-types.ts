import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";

type EventType = components["schemas"]["EventType"];
type CreateEventTypeBody = components["schemas"]["CreateEventTypeBody"];
type NotFoundError = components["schemas"]["NotFoundError"];
type ValidationError = components["schemas"]["ValidationError"];

// snake_case колонки таблицы → camelCase модель контракта.
type EventTypeRow = {
  id: number;
  owner_email: string;
  name: string;
  description: string;
  duration_minutes: number;
};

function toEventType(row: EventTypeRow): EventType {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
  };
}

/**
 * Тип встречи владельца по id — или `undefined`, если такого нет у этого
 * владельца (чужой id ведёт себя так же, как несуществующий).
 */
export function createEventTypeLoader(db: DatabaseSync) {
  const selectOne = db.prepare(
    `SELECT id, owner_email, name, description, duration_minutes
     FROM event_types WHERE owner_email = ? AND id = ?`,
  );
  return (ownerEmail: string, id: number): EventType | undefined => {
    const row = selectOne.get(ownerEmail, id) as EventTypeRow | undefined;
    return row && toEventType(row);
  };
}

/** POST /api/owners/:ownerEmail/event-types — 201 с созданным типом встречи. */
export function createCreateEventTypeHandler(db: DatabaseSync) {
  const insert = db.prepare(
    "INSERT INTO event_types (owner_email, name, description, duration_minutes) VALUES (?, ?, ?, ?)",
  );

  return async (
    request: FastifyRequest<{
      Params: { ownerEmail: string };
      Body: CreateEventTypeBody;
    }>,
    reply: FastifyReply,
  ): Promise<EventType | ValidationError> => {
    const { ownerEmail } = request.params;
    const { durationMinutes } = request.body;
    // Контракт проверяет длину сырой строки, но Ajv не умеет сначала обрезать
    // пробелы: "   " прошло бы minLength(1). Поэтому границы — ещё раз здесь, после trim.
    const name = request.body.name.trim();
    const description = request.body.description.trim();
    const errors: ValidationError["errors"] = [];
    if (name.length < 1) {
      errors.push({ path: "name", message: "must not be empty after trimming" });
    }
    if (description.length < 1) {
      errors.push({ path: "description", message: "must not be empty after trimming" });
    }
    if (errors.length > 0) {
      reply.code(422);
      return { message: "invalid event type", errors };
    }
    const { lastInsertRowid } = insert.run(ownerEmail, name, description, durationMinutes);

    reply.code(201);
    return { id: Number(lastInsertRowid), ownerEmail, name, description, durationMinutes };
  };
}

/** GET /api/owners/:ownerEmail/event-types — типы встречи владельца, старые первыми. */
export function createListEventTypesHandler(db: DatabaseSync) {
  const selectAll = db.prepare(
    `SELECT id, owner_email, name, description, duration_minutes
     FROM event_types WHERE owner_email = ? ORDER BY id`,
  );

  return async (
    request: FastifyRequest<{ Params: { ownerEmail: string } }>,
  ): Promise<EventType[]> =>
    (selectAll.all(request.params.ownerEmail) as EventTypeRow[]).map(toEventType);
}

/** GET /api/owners/:ownerEmail/event-types/:eventTypeId — один тип встречи или 404. */
export function createGetEventTypeHandler(db: DatabaseSync) {
  const loadEventType = createEventTypeLoader(db);

  return async (
    request: FastifyRequest<{ Params: { ownerEmail: string; eventTypeId: number } }>,
    reply: FastifyReply,
  ): Promise<EventType | NotFoundError> => {
    const { ownerEmail, eventTypeId } = request.params;
    const eventType = loadEventType(ownerEmail, Number(eventTypeId));
    if (!eventType) {
      reply.code(404);
      return { message: "event type not found" };
    }
    return eventType;
  };
}
