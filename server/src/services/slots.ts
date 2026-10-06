import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";
import { GRID_STEP_MS, firstGridStart, overlapsAny, windowEnd } from "./slot-window.js";

type NotFoundError = components["schemas"]["NotFoundError"];

type EventTypeRow = { duration: number };
type BookingRow = { start: string; end: string };

/** GET /api/owners/:ownerEmail/event-types/:id/slots — свободные начала слотов. */
export function createListSlotsHandler(db: DatabaseSync, clock: () => Date) {
  const findEventType = db.prepare(
    "SELECT duration FROM event_types WHERE id = ? AND owner_email = ?",
  );
  // Занятость общая для всех типов встреч владельца — выбираем все его брони.
  const selectBookings = db.prepare(
    "SELECT start, end FROM bookings WHERE owner_email = ?",
  );

  return async (
    request: FastifyRequest<{ Params: { ownerEmail: string; id: string } }>,
    reply: FastifyReply,
  ): Promise<string[] | NotFoundError> => {
    const { ownerEmail, id } = request.params;
    const eventType = findEventType.get(Number(id), ownerEmail) as
      | EventTypeRow
      | undefined;
    if (!eventType) {
      reply.code(404);
      return { message: "event type not found" };
    }

    const now = clock();
    const end = windowEnd(now);
    const durationMs = eventType.duration * 60 * 1000;
    const bookings = selectBookings.all(ownerEmail) as BookingRow[];

    const slots: string[] = [];
    for (
      let start = firstGridStart(now).getTime();
      start < end.getTime();
      start += GRID_STEP_MS
    ) {
      if (!overlapsAny(start, start + durationMs, bookings)) {
        slots.push(new Date(start).toISOString());
      }
    }
    return slots;
  };
}
