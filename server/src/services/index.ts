import { health } from "./health.js";

// One handler per operationId from the generated contract (contract/openapi.yaml).
// fastify-openapi-glue maps each operation to the handler with the same key.
export const serviceHandlers = {
  health,
};
