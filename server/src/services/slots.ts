import type { DatabaseSync } from "node:sqlite";
import type { FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";
import { createLadderLoader } from "./ladder-source.js";

type Slot = components["schemas"]["Slot"];

/**
 * GET /api/owners/:ownerEmail/slots?duration=15|30|45 — лестница слотов за всё
 * окно, плоским списком: группировку по датам делает браузер гостя в своём
 * часовом поясе (см. issue #39).
 */
export function createListSlotsHandler(db: DatabaseSync, clock: () => Date) {
  const loadLadder = createLadderLoader(db);

  return async (
    request: FastifyRequest<{
      Params: { ownerEmail: string };
      Querystring: { duration: number };
    }>,
  ): Promise<Slot[]> => {
    const { cells } = loadLadder(
      request.params.ownerEmail,
      Number(request.query.duration),
      clock().getTime(),
    );
    return cells.map((cell) => ({
      start: new Date(cell.start).toISOString(),
      end: new Date(cell.end).toISOString(),
      status: cell.status,
    }));
  };
}
