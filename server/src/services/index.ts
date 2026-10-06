import type { DatabaseSync } from "node:sqlite";
import { health } from "./health.js";
import {
  createCreateEventTypeHandler,
  createListEventTypesHandler,
} from "./event-types.js";
import { createListSlotsHandler } from "./slots.js";
import { createCreateBookingHandler } from "./bookings.js";

// Один хендлер на operationId из контракта (contract/openapi.yaml);
// fastify-openapi-glue связывает операцию с хендлером по ключу.
// Хендлерам нужна база — поэтому собираем объект фабрикой.
export function createServiceHandlers(db: DatabaseSync, clock: () => Date) {
  return {
    health,
    createEventType: createCreateEventTypeHandler(db),
    listEventTypes: createListEventTypesHandler(db),
    listSlots: createListSlotsHandler(db, clock),
    createBooking: createCreateBookingHandler(db, clock),
  };
}
