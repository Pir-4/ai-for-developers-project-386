import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";
import { createEventTypeLoader } from "./event-types.js";
import { createLadderLoader } from "./ladder-source.js";

type Slot = components["schemas"]["Slot"];
type NotFoundError = components["schemas"]["NotFoundError"];

/**
 * GET /api/event-types/:eventTypeId/slots — лестница 30-минутных слотов
 * за всё окно, плоским списком: группировку по датам
 * делает браузер гостя в своём часовом поясе (см. issue #39).
 */
export function createListSlotsHandler(db: DatabaseSync, clock: () => Date) {
  const loadEventType = createEventTypeLoader(db);
  const loadLadder = createLadderLoader(db);

  return async (
    request: FastifyRequest<{
      Params: { eventTypeId: number };
    }>,
    reply: FastifyReply,
  ): Promise<Slot[] | NotFoundError> => {
    const eventType = loadEventType(Number(request.params.eventTypeId));
    if (!eventType) {
      reply.code(404);
      return { message: "event type not found" };
    }

    const { cells } = loadLadder(eventType.durationMinutes, clock().getTime());
    return cells.map((cell) => ({
      start: new Date(cell.start).toISOString(),
      end: new Date(cell.end).toISOString(),
      status: cell.status,
    }));
  };
}
