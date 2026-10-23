import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";
import { SLOT_MINUTES } from "./slot-ladder.js";

type EventType = components["schemas"]["EventType"];
type CreateEventTypeBody = components["schemas"]["CreateEventTypeBody"];
type NotFoundError = components["schemas"]["NotFoundError"];
type ValidationError = components["schemas"]["ValidationError"];

// snake_case колонки таблицы → camelCase модель контракта.
type EventTypeRow = {
  id: number;
  name: string;
  description: string;
  duration_minutes: number;
};

function toEventType(row: EventTypeRow): EventType {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
  };
}

/**
 * Тип встречи по id — или `undefined`, если такого нет.
 */
export function createEventTypeLoader(db: DatabaseSync) {
  const selectOne = db.prepare(
    "SELECT id, name, description, duration_minutes FROM event_types WHERE id = ?",
  );
  return (id: number): EventType | undefined => {
    const row = selectOne.get(id) as EventTypeRow | undefined;
    return row && toEventType(row);
  };
}

/** POST /api/event-types — 201 с созданным типом встречи (всегда 30 минут). */
export function createCreateEventTypeHandler(db: DatabaseSync) {
  const insert = db.prepare(
    "INSERT INTO event_types (name, description, duration_minutes) VALUES (?, ?, ?)",
  );

  return async (
    request: FastifyRequest<{ Body: CreateEventTypeBody }>,
    reply: FastifyReply,
  ): Promise<EventType | ValidationError> => {
    const durationMinutes = SLOT_MINUTES;
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
    const { lastInsertRowid } = insert.run(name, description, durationMinutes);

    reply.code(201);
    return { id: Number(lastInsertRowid), name, description, durationMinutes };
  };
}

/** GET /api/event-types — типы встречи, старые первыми. */
export function createListEventTypesHandler(db: DatabaseSync) {
  const selectAll = db.prepare(
    "SELECT id, name, description, duration_minutes FROM event_types ORDER BY id",
  );

  return async (): Promise<EventType[]> =>
    (selectAll.all() as EventTypeRow[]).map(toEventType);
}

/** GET /api/event-types/:eventTypeId — один тип встречи или 404. */
export function createGetEventTypeHandler(db: DatabaseSync) {
  const loadEventType = createEventTypeLoader(db);

  return async (
    request: FastifyRequest<{ Params: { eventTypeId: number } }>,
    reply: FastifyReply,
  ): Promise<EventType | NotFoundError> => {
    const eventType = loadEventType(Number(request.params.eventTypeId));
    if (!eventType) {
      reply.code(404);
      return { message: "event type not found" };
    }
    return eventType;
  };
}
