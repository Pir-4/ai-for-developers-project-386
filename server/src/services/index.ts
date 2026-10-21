import type { DatabaseSync } from "node:sqlite";
import { health } from "./health.js";
import {
  createListAvailabilityHandler,
  createSetAvailabilityHandler,
} from "./availability.js";
import {
  createCreateEventTypeHandler,
  createGetEventTypeHandler,
  createListEventTypesHandler,
} from "./event-types.js";
import { createListSlotsHandler } from "./slots.js";
import { createCreateBookingHandler } from "./bookings.js";
import { createListMeetingsHandler } from "./meetings.js";

// Один хендлер на operationId из контракта (contract/openapi.yaml);
// fastify-openapi-glue связывает операцию с хендлером по ключу.
// Хендлерам нужна база — поэтому собираем объект фабрикой.
export function createServiceHandlers(db: DatabaseSync, clock: () => Date) {
  return {
    health,
    setAvailability: createSetAvailabilityHandler(db, clock),
    listAvailability: createListAvailabilityHandler(db, clock),
    createEventType: createCreateEventTypeHandler(db),
    listEventTypes: createListEventTypesHandler(db),
    getEventType: createGetEventTypeHandler(db),
    listSlots: createListSlotsHandler(db, clock),
    createBooking: createCreateBookingHandler(db, clock),
    listMeetings: createListMeetingsHandler(db, clock),
  };
}
