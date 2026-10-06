import type { DatabaseSync } from "node:sqlite";
import type { FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";

type Meeting = components["schemas"]["Meeting"];

type MeetingRow = {
  id: number;
  owner_email: string;
  start: string;
  end: string;
  duration_minutes: number;
  guest_name: string;
  guest_email: string;
};

function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    start: row.start,
    end: row.end,
    durationMinutes: row.duration_minutes,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
  };
}

/** GET /api/owners/:ownerEmail/meetings — брони владельца, ещё не завершившиеся, по возрастанию start. */
export function createListMeetingsHandler(db: DatabaseSync, clock: () => Date) {
  const selectUpcoming = db.prepare(
    `SELECT id, owner_email, start, end, duration_minutes, guest_name, guest_email
     FROM bookings
     WHERE owner_email = ? AND end >= ?
     ORDER BY start ASC`,
  );

  return async (
    request: FastifyRequest<{ Params: { ownerEmail: string } }>,
  ): Promise<Meeting[]> => {
    const { ownerEmail } = request.params;
    const now = clock().toISOString();
    return (selectUpcoming.all(ownerEmail, now) as MeetingRow[]).map(toMeeting);
  };
}
