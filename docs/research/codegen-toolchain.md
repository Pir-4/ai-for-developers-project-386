# Research: Codegen toolchain (TypeSpec → OpenAPI → client SDK + Fastify server artifacts)

Resolves GitHub issue #13 (part of wayfinder map #7). Versions and dates verified against
primary sources (npm registry, official docs) on **2026-10-04**.

Hard constraints applied to every option:

- Node 22 runtime; locally Node 22.11 → **nothing may require Node ≥ 22.12** (same rule as the vite/vitest/@fastify/static pins in AGENTS.md).
- TypeScript strict, ESM / `NodeNext`, npm workspaces (`server/`, `web/`).
- TypeSpec is the source of truth → OpenAPI is generated → client SDK and server artifacts are generated from OpenAPI.
- Full regeneration via a single command; generated code is never hand-edited.

## TL;DR — recommended stack

| Slot | Tool | Version (2026-10) | Why |
|---|---|---|---|
| TypeSpec → OpenAPI 3 | `@typespec/openapi3` | 1.16.0 | The only/first-party emitter (Microsoft); Node ≥22.0; emits 3.0/3.1/3.2 |
| OpenAPI → TS client (`web/`) | `openapi-typescript` + `openapi-fetch` | 7.13.0 / 0.17.0 | Full type safety, ~6 kB runtime, ESM, no Node engines floor, actively maintained |
| OpenAPI → Fastify 5 server (`server/`) | `fastify-openapi-glue` + `openapi-typescript` types | 4.11.5 / 7.13.0 | Route wiring + JSON-schema validation straight from the spec (design-first); handlers hand-written but typed with the generated types |

Regeneration is one npm script: `tsp compile . && openapi-typescript <openapi.yaml> -o <types.d.ts>` (exact paths are decided in ticket #15, contract pipeline layout).

---

## Slot 1: TypeSpec → OpenAPI 3 emitter

### Options

| Option | Status | Notes |
|---|---|---|
| `@typespec/openapi3` 1.16.0 (Microsoft) | Active — `time.modified` 2026-10-02 | The first-party, effectively only OpenAPI emitter for TypeSpec. Emits OpenAPI **3.0.0 / 3.1.0 / 3.2.0** (`openapi-versions` option, default `["3.0.0"]`), YAML or JSON. `engines.node: >=22.0.0` ✅. ESM (`"type": "module"`). |
| Hand-written OpenAPI YAML | — | Violates "TypeSpec is the source of truth". Rejected. |
| `@typespec/http-server-javascript` 0.58.0-alpha.9 | Alpha, last publish 2025-03-19 | Skips OpenAPI and generates a JS server directly; alpha quality, JS-only, stale. Not a substitute for the contract artifact. Rejected. |

There is no meaningful competition for this slot: the emitter is part of the TypeSpec
project itself, so "which emitter" is really "how to configure `@typespec/openapi3`".

### Expected output shape

`tsp compile .` with

```yaml
# tspconfig.yaml
emit:
  - "@typespec/openapi3"
options:
  "@typespec/openapi3":
    output-file: "openapi.yaml"
```

produces a single `openapi.yaml` (default name `{service-name-if-multiple}.{version}.openapi.yaml`;
configurable via `output-file`). Other relevant options (from the official README):
`file-type` (`yaml`/`json`), `omit-unreachable-types`, `seal-object-schemas`,
`operation-id-strategy`, `enum-strategy`.

### 3.0 vs 3.1 recommendation

Emit **OpenAPI 3.0.0** (the default):

- Fastify validates with Ajv on **JSON Schema draft-07 out of the box**; OpenAPI 3.1 schemas
  are draft 2020-12 and need custom Ajv-2020 wiring (fastify-openapi-glue documents this in
  `docs/schema2020.md`). Our schemas (30-minute slots, ISO-8601 strings) use nothing that
  3.0 can't express.
- Every downstream consumer we evaluated (openapi-typescript, fastify-openapi-glue, Orval,
  Hey API) accepts 3.0.

Switching to 3.1 later is a one-line emitter option change if ever needed.

Sources:
- npm `@typespec/openapi3` (version, engines, ESM, publish date): https://www.npmjs.com/package/@typespec/openapi3
- Emitter options & usage: https://github.com/microsoft/typespec/tree/main/packages/openapi3 (README)
- npm `@typespec/http-server-javascript`: https://www.npmjs.com/package/@typespec/http-server-javascript

---

## Slot 2: OpenAPI → TypeScript client SDK for `web/` (Vite 6 + React 19)

| | **openapi-typescript + openapi-fetch** | **Hey API** (`@hey-api/openapi-ts`) | **Orval** | **openapi-generator** (typescript-fetch) |
|---|---|---|---|---|
| Version / maintenance | 7.13.0 / 0.17.0; last publish 2026-06-15; openapi-ts org | 0.99.0; publish 2026-09-30; very active | 8.39.0; publish 2026-09-30; very active | npm wrapper 1.0.0 (2025-07); generator itself Java-based 7.x, active |
| Type safety | Excellent: `paths`/`operations` types are compile-time only; `openapi-fetch` is generic over `paths` | Excellent, generated SDK functions per operation | Excellent, functions + optional react-query/swr hooks, zod schemas | Good but verbose; class-based clients, `any`-prone in places |
| Runtime weight | ~**6 kB** (openapi-fetch), types are runtime-free | `@hey-api/client-fetch` runtime + generated SDK | Generated functions on fetch/axios; optional zod/msw add weight | Heavy (generated `runtime.ts` + per-model files) |
| ESM / NodeNext | Native ESM; docs explicitly show `moduleResolution: NodeNext` ✅ | ESM ✅ | ESM ✅ | ESM output possible; historically CJS-flavored |
| **Node engines** | **none** ✅ (Node 20+ recommended) | **`>=22.18.0`** ❌ | **`>=22.18.0`** ❌ | needs a **JRE** at codegen time ❌ |
| Fit notes | Framework-agnostic; pairs with plain fetch — ideal for a small React app without a query library | Nicest DX (SDK, plugins incl. zod, TanStack Query, and a beta Fastify plugin) | Best when you want react-query hooks + MSW mocks generated | Worst fit: Java toolchain, bulky output |

### Why openapi-typescript + openapi-fetch

1. **Node 22.11 constraint is decisive**: Hey API 0.99.0 and Orval 8.39.0 both declare
   `engines.node >= 22.18.0` — the same class of problem AGENTS.md pins vite/vitest for.
   `openapi-typescript`/`openapi-fetch` have no engines floor.
2. Runtime-free types: the generated `*.d.ts` has zero runtime footprint; `openapi-fetch`
   is a 6 kB client ("virtually zero runtime", works with any framework — fine with React 19).
3. Single file in, single file out — trivial to keep "generated, never hand-edited".
4. Actively maintained (openapi-ts org; 7.x line, OpenAPI 3.0 & 3.1 incl. discriminators).

If the local Node is upgraded to ≥ 22.18 later, Hey API becomes an attractive upgrade
(richer SDK + optional generated zod validators), but that is explicitly out of bounds today.

Sources:
- https://openapi-ts.dev/introduction (7.x features, NodeNext guidance)
- npm `openapi-typescript` / `openapi-fetch` (versions, dates, 6 kB README claim): https://www.npmjs.com/package/openapi-typescript , https://www.npmjs.com/package/openapi-fetch
- npm `@hey-api/openapi-ts` (0.99.0, engines, date): https://www.npmjs.com/package/@hey-api/openapi-ts
- npm `orval` (8.39.0, engines, date): https://www.npmjs.com/package/orval
- Hey API plugins docs: https://heyapi.dev/docs/openapi/typescript/core

---

## Slot 3: OpenAPI → Fastify 5 server artifacts (`server/`)

| | **fastify-openapi-glue** + openapi-typescript types | **Manual wiring** (openapi-typescript types + schemas from the spec) | **Hey API Fastify plugin** | **json-schema-to-ts / type providers** |
|---|---|---|---|---|
| Version / maintenance | 4.11.5; publish 2026-09-18; seriousme, CI + codecov active | openapi-typescript 7.13.0 (2026-06); Fastify 5 native generics | Beta (heyapi.dev marks it Beta); `@hey-api/openapi-ts` 0.99.0 | `json-schema-to-ts` 3.1.1 stale since 2024-08-29; `@fastify/type-provider-json-schema-to-ts` 5.0.0 active |
| What is generated | Route table + AJV request/response validation **from the spec at runtime**; you register one plugin with `specification` + `serviceHandlers` | Types only; routes and schema objects are hand-written per route | Typed route-handler glue (`fastify.gen.ts`, `RouteHandlers` interface) | Nothing — schemas are hand-written in code (code-first) |
| Type safety of handlers | Runtime validation guaranteed (it *is* the spec); handler bodies typed by hand via generated `components`/`paths` types — enforced per handler, not globally | Full, per-route via Fastify generics (`app.post<{Body: ...}>`) | Full, generated `RouteHandlers` interface checks handler signatures | Full, but against hand-written schemas, not the contract |
| Validation source | The OpenAPI file itself (single source of truth) | JSON Schema objects lifted from the OpenAPI file | From spec (validators/plugins) | Hand-written schemas — drift risk, violates contract-first |
| ESM | Plugin is ESM (README calls it out) ✅ | ✅ | ✅ | ✅ |
| **Node engines** | `>=20.0.0` ✅ | none ✅ | `>=22.18.0` ❌ (generator) | `>=16` ✅ but direction is wrong |
| OpenAPI 3.1 | Supported with extra Ajv-2020 config (`docs/schema2020.md`); 3.0 works out of the box | Same Ajv caveat | n/a (blocked) | n/a |

### Why fastify-openapi-glue + openapi-typescript

- It is **design-first by construction**: routes, content negotiation and JSON-schema
  validation are derived from the generated `openapi.yaml` — the contract literally is the
  server config. No second schema definition can drift from the contract.
- Active maintenance (4.11.5, Sept 2026), ESM, Fastify 5-compatible (`fastify-plugin ^6`),
  Node ≥ 20.
- The missing piece — static typing of the handlers — is closed by reusing the **same**
  `openapi-typescript` artifact the client uses: handler params/results are annotated with
  `components["schemas"][...]` / `paths[...]` types. The type link is per-handler rather
  than compiler-enforced across the whole route table; acceptable for a ~4-endpoint API.

### What stays hand-written (recommended stack)

- `serviceHandlers`: one async method per `operationId` — the actual business logic
  (slot listing, booking, DB access). **This is the only server code that exists.**
- Registration of the glue plugin in `buildApp()` (spec path, `prefix: "/api"`).
- Type annotations on handlers referencing the generated types (a few `import type` lines).
- The `codegen` npm script itself.
- Everything else — spec, client SDK, server types, route table, request/response
  validation — is generated.

### Alternatives kept on the shelf

- **Manual wiring (Option B)**: zero extra runtime deps and fully typed routes, but route
  wiring and schema plumbing are hand-written per endpoint. Good fallback if glue ever
  misbehaves; for this tiny API the difference is small either way.
- **Hey API Fastify plugin**: the most elegant typed-handler story, but Beta +
  `engines.node >= 22.18.0` → blocked by the Node pin. Revisit after a Node upgrade.
- **json-schema-to-ts / type providers / TypeBox / zod**: all are *code-first* — schemas
  authored in TS, contract derived from code. That inverts the agreed direction
  (TypeSpec → everything). Additionally `json-schema-to-ts` has not shipped since 2024-08.
- **`@typespec/http-server-javascript`**: alpha (0.58.0-alpha.9, 2025-03), generates a JS
  server skeleton straight from TypeSpec, skipping the OpenAPI artifact we need for the
  client. Rejected.

Sources:
- npm `fastify-openapi-glue` + README (design-first usage, ESM note, schema2020 note, CLI generator): https://www.npmjs.com/package/fastify-openapi-glue , repo https://github.com/seriousme/fastify-openapi-glue
- Hey API Fastify plugin docs (Beta banner, output shape): https://heyapi.dev/docs/openapi/typescript/plugins/fastify
- Fastify v5 TypeScript docs (route generics `Body/Querystring/Params/Reply`, type providers): https://fastify.dev/docs/latest/Reference/TypeScript/
- npm `json-schema-to-ts` (stale), `@fastify/type-provider-json-schema-to-ts`, `fastify-type-provider-zod`: https://www.npmjs.com/package/json-schema-to-ts

---

## Constraint compliance check (recommended stack)

| Constraint | `@typespec/openapi3` | `openapi-typescript` | `openapi-fetch` | `fastify-openapi-glue` |
|---|---|---|---|---|
| Node 22.11-safe (no ≥22.12 floor) | ✅ `>=22.0.0` | ✅ none | ✅ none | ✅ `>=20.0.0` |
| ESM / NodeNext | ✅ | ✅ | ✅ | ✅ |
| TS strict-friendly | n/a (emitter) | ✅ runtime-free types | ✅ | ✅ (types come from openapi-typescript) |
| Works with pinned vite 6 / vitest 3 / @fastify/static 9 | ✅ (dev-time only) | ✅ (dev-time only) | ✅ (browser runtime) | ✅ (server runtime) |
| Single-command regeneration | `tsp compile . && openapi-typescript ...` in one npm script | — | — | reads the spec file at boot |
| Generated code never hand-edited | ✅ | ✅ | n/a | ✅ (no code generated at all — spec is consumed at runtime) |

## Decision

Adopt: **`@typespec/openapi3` (OpenAPI 3.0.0 YAML) → `openapi-typescript` + `openapi-fetch`
for `web/` → `fastify-openapi-glue` + `openapi-typescript` types for `server/`.**

File layout of the artifacts (contract dir, generated dirs, script wiring) is the subject
of ticket #15 and is deliberately not decided here.
