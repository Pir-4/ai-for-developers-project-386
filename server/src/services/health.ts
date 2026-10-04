import type { components } from "../generated/schema.js";

/** GET /api/health — liveness probe (typed against the generated contract). */
export const health = async (): Promise<components["schemas"]["HealthStatus"]> => ({
  status: "ok",
});
