import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";
import { firstGridStart, isOnGrid, overlapsAny, windowEnd } from "./slot-window.js";

type Booking = components["schemas"]["Booking"];
type CreateBookingBody = components["schemas"]["CreateBookingBody"];
type NotFoundError = components["schemas"]["NotFoundError"];
type ConflictError = components["schemas"]["ConflictError"];
type ValidationError = components["schemas"]["ValidationError"];

type EventTypeRow = { duration: number };
type BookingRow = { start: string; end: string };

function invalidStart(message: string): ValidationError {
  return { message: "invalid start", errors: [{ path: "start", message }] };
}

/** POST /api/owners/:ownerEmail/event-types/:id/bookings — бронирует слот. */
export function createCreateBookingHandler(db: DatabaseSync, clock: () => Date) {
  const findEventType = db.prepare(
    "SELECT duration FROM event_types WHERE id = ? AND owner_email = ?",
  );
  // Занятость общая для всех типов встреч владельца — проверяем по всем его броням.
  const selectBookings = db.prepare(
    "SELECT start, end FROM bookings WHERE owner_email = ?",
  );
  const insert = db.prepare(
    `INSERT INTO bookings (event_type_id, owner_email, start, end, guest_name, guest_email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  return async (
    request: FastifyRequest<{
      Params: { ownerEmail: string; id: string };
      Body: CreateBookingBody;
    }>,
    reply: FastifyReply,
  ): Promise<Booking | NotFoundError | ConflictError | ValidationError> => {
    const { ownerEmail, id } = request.params;
    const { guestEmail, start } = request.body;
    const now = clock();
    // "1–100 символов после trim" — контракт не проверяет длину сырой строки
    // (Ajv не умеет сначала обрезать пробелы), поэтому обе границы — здесь.
    const guestName = request.body.guestName.trim();
    if (guestName.length < 1 || guestName.length > 100) {
      reply.code(422);
      return {
        message: "invalid guestName",
        errors: [
          {
            path: "guestName",
            message: "must be 1-100 characters after trimming",
          },
        ],
      };
    }

    const startMs = Date.parse(start);
    if (!isOnGrid(startMs)) {
      reply.code(422);
      return invalidStart("must be on the :00/:30 grid");
    }

    if (startMs < firstGridStart(now).getTime()) {
      reply.code(422);
      return invalidStart("must not be in the past");
    }
    if (startMs >= windowEnd(now).getTime()) {
      reply.code(422);
      return invalidStart("must be within the booking window");
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      const eventType = findEventType.get(Number(id), ownerEmail) as
        | EventTypeRow
        | undefined;
      if (!eventType) {
        db.exec("ROLLBACK");
        reply.code(404);
        return { message: "event type not found" };
      }

      const endMs = startMs + eventType.duration * 60 * 1000;
      const bookings = selectBookings.all(ownerEmail) as BookingRow[];
      if (overlapsAny(startMs, endMs, bookings)) {
        db.exec("ROLLBACK");
        reply.code(409);
        return { message: "slot is already booked" };
      }

      const end = new Date(endMs).toISOString();
      const createdAt = now.toISOString();
      const { lastInsertRowid } = insert.run(
        Number(id),
        ownerEmail,
        start,
        end,
        guestName,
        guestEmail,
        createdAt,
      );
      db.exec("COMMIT");

      reply.code(201);
      return {
        id: Number(lastInsertRowid),
        eventTypeId: Number(id),
        ownerEmail,
        start,
        end,
        guestName,
        guestEmail,
        createdAt,
      };
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };
}
