import type { DatabaseSync } from "node:sqlite";
import { health } from "./health.js";
import {
  createCreateEventTypeHandler,
  createListEventTypesHandler,
} from "./event-types.js";

// Один хендлер на operationId из контракта (contract/openapi.yaml);
// fastify-openapi-glue связывает операцию с хендлером по ключу.
// Хендлерам нужна база — поэтому собираем объект фабрикой.
export function createServiceHandlers(db: DatabaseSync) {
  return {
    health,
    createEventType: createCreateEventTypeHandler(db),
    listEventTypes: createListEventTypesHandler(db),
  };
}
