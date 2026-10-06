import type { DatabaseSync } from "node:sqlite";
import type { FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";

type Meeting = components["schemas"]["Meeting"];

type MeetingRow = {
  id: number;
  event_type_id: number;
  event_type_name: string;
  owner_email: string;
  start: string;
  end: string;
  guest_name: string;
  guest_email: string;
};

function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    eventTypeId: row.event_type_id,
    eventTypeName: row.event_type_name,
    ownerEmail: row.owner_email,
    start: row.start,
    end: row.end,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
  };
}

/** GET /api/owners/:ownerEmail/meetings — брони владельца, ещё не завершившиеся, по возрастанию start. */
export function createListMeetingsHandler(db: DatabaseSync, clock: () => Date) {
  const selectUpcoming = db.prepare(
    `SELECT
       b.id AS id,
       b.event_type_id AS event_type_id,
       et.name AS event_type_name,
       b.owner_email AS owner_email,
       b.start AS start,
       b.end AS end,
       b.guest_name AS guest_name,
       b.guest_email AS guest_email
     FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     WHERE b.owner_email = ? AND b.end >= ?
     ORDER BY b.start ASC`,
  );

  return async (
    request: FastifyRequest<{ Params: { ownerEmail: string } }>,
  ): Promise<Meeting[]> => {
    const { ownerEmail } = request.params;
    const now = clock().toISOString();
    return (selectUpcoming.all(ownerEmail, now) as MeetingRow[]).map(
      toMeeting,
    );
  };
}
