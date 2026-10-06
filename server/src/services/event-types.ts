import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";

type EventType = components["schemas"]["EventType"];
type CreateEventTypeBody = components["schemas"]["CreateEventTypeBody"];

// snake_case колонки таблицы → camelCase модель контракта.
type EventTypeRow = {
  id: number;
  owner_email: string;
  name: string;
  description: string;
  duration: number;
};

function toEventType(row: EventTypeRow): EventType {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    description: row.description,
    duration: row.duration,
  };
}

/** POST /api/owners/:ownerEmail/event-types — 201 с созданным типом встречи. */
export function createCreateEventTypeHandler(db: DatabaseSync) {
  const insert = db.prepare(
    "INSERT INTO event_types (owner_email, name, description, duration) VALUES (?, ?, ?, ?)",
  );

  return async (
    request: FastifyRequest<{
      Params: { ownerEmail: string };
      Body: CreateEventTypeBody;
    }>,
    reply: FastifyReply,
  ): Promise<EventType> => {
    const { ownerEmail } = request.params;
    const { name, description, duration } = request.body;
    const { lastInsertRowid } = insert.run(
      ownerEmail,
      name,
      description,
      duration,
    );

    reply.code(201);
    return {
      id: Number(lastInsertRowid),
      ownerEmail,
      name,
      description,
      duration,
    };
  };
}

/** GET /api/owners/:ownerEmail/event-types — типы встречи владельца, старые первыми. */
export function createListEventTypesHandler(db: DatabaseSync) {
  const selectAll = db.prepare(
    "SELECT id, owner_email, name, description, duration FROM event_types WHERE owner_email = ? ORDER BY id",
  );

  return async (
    request: FastifyRequest<{ Params: { ownerEmail: string } }>,
  ): Promise<EventType[]> =>
    (selectAll.all(request.params.ownerEmail) as EventTypeRow[]).map(
      toEventType,
    );
}
