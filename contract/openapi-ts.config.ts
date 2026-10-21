import { defineConfig } from "@hey-api/openapi-ts";

// The web client SDK: typed functions per operationId, generated from the OpenAPI spec that
// `tsp compile` emits. Run via `make generate`; the output is committed and never hand-edited.
export default defineConfig({
  input: "openapi.yaml",
  output: "../web/src/generated/api",
  plugins: [
    // Requests go to the same origin under /api (Vite dev proxy; the single prod process).
    { name: "@hey-api/client-fetch", baseUrl: "/api" },
    "@hey-api/typescript",
    "@hey-api/sdk",
  ],
});
