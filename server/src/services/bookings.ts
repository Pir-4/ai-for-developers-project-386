import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { components } from "../generated/schema.js";
import { createLadderLoader } from "./ladder-source.js";

type Booking = components["schemas"]["Booking"];
type CreateBookingBody = components["schemas"]["CreateBookingBody"];
type NotFoundError = components["schemas"]["NotFoundError"];
type ConflictError = components["schemas"]["ConflictError"];
type ValidationError = components["schemas"]["ValidationError"];

function invalidStart(message: string): ValidationError {
  return { message: "invalid start", errors: [{ path: "start", message }] };
}

/** POST /api/owners/:ownerEmail/bookings — бронирует слот на календаре владельца. */
export function createCreateBookingHandler(db: DatabaseSync, clock: () => Date) {
  const loadLadder = createLadderLoader(db);
  const insert = db.prepare(
    `INSERT INTO bookings (owner_email, start, end, duration_minutes, guest_name, guest_email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  return async (
    request: FastifyRequest<{
      Params: { ownerEmail: string };
      Body: CreateBookingBody;
    }>,
    reply: FastifyReply,
  ): Promise<Booking | NotFoundError | ConflictError | ValidationError> => {
    const { ownerEmail } = request.params;
    const { guestEmail, start, durationMinutes } = request.body;
    // "1–100 символов после trim" — контракт не проверяет длину сырой строки
    // (Ajv не умеет сначала обрезать пробелы), поэтому обе границы — здесь.
    const guestName = request.body.guestName.trim();
    if (guestName.length < 1 || guestName.length > 100) {
      reply.code(422);
      return {
        message: "invalid guestName",
        errors: [
          { path: "guestName", message: "must be 1-100 characters after trimming" },
        ],
      };
    }

    const now = clock();
    const startMs = Date.parse(start);

    db.exec("BEGIN IMMEDIATE");
    try {
      // Лестница пересчитывается здесь же, под той же транзакцией: гость может
      // бронировать только то, что ему реально предлагалось.
      const { hasAvailability, cells } = loadLadder(
        ownerEmail,
        durationMinutes,
        now.getTime(),
      );
      if (!hasAvailability) {
        db.exec("ROLLBACK");
        reply.code(404);
        return { message: "owner has no availability" };
      }

      const cell = cells.find((candidate) => candidate.start === startMs);
      if (!cell) {
        db.exec("ROLLBACK");
        reply.code(422);
        return invalidStart("must be a slot of the owner's ladder for this duration");
      }
      if (cell.status === "busy") {
        db.exec("ROLLBACK");
        reply.code(409);
        return { message: "slot is already booked" };
      }

      const end = new Date(cell.end).toISOString();
      const createdAt = now.toISOString();
      const { lastInsertRowid } = insert.run(
        ownerEmail,
        start,
        end,
        durationMinutes,
        guestName,
        guestEmail,
        createdAt,
      );
      db.exec("COMMIT");

      reply.code(201);
      return {
        id: Number(lastInsertRowid),
        ownerEmail,
        start,
        end,
        durationMinutes,
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
