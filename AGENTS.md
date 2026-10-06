# AGENTS.md

## Project

"Call booking" — a Hexlet learning project (ai-for-developers program): a simplified Cal.com.
The owner publishes 30-minute slots, a guest books a slot, the owner views the list of upcoming meetings.

Deliberately **out of scope** (do not add): authentication, personal accounts, external calendar integrations.
Behavior reference — video in README: https://files.hexlet.app/a/2ipc5m

## Workflow

- Development in stages, contract-first: contract (TypeSpec sources in `contract/` + `make generate`) →
  frontend → backend → scenario tests → deploy. Do not skip stages unless the user explicitly asks.
- The TypeSpec sources in `contract/` are the source of truth. Changing API behavior = edit the TypeSpec first,
  run `make generate`, commit the regenerated artifacts, then the code. Generated artifacts (`contract/openapi.yaml`,
  `server/src/generated/`, `web/src/generated/`) are committed but never hand-edited; CI fails if they drift.
- Final readiness criterion: the image builds and runs (`make docker-build && make docker-run`).
- Only the agent writes code; the user does not edit code by hand.

## Stack and structure

- Node.js 22+, TypeScript (strict, ESM/NodeNext), npm workspaces: `contract/`, `server/` and `web/`.
- `contract/` — the API contract: TypeSpec sources (`main.tsp`, `tspconfig.yaml`). `make generate` emits the
  OpenAPI 3.0 spec (`contract/openapi.yaml`), the JSON copy for the server runtime
  (`server/src/generated/openapi.json`) and `openapi-typescript` types for server and web (`*/src/generated/schema.d.ts`).
- `server/` — Fastify 5. `src/app.ts` — `buildApp({ dbPath })`: `fastify-openapi-glue` registers routes and request
  validation from `src/generated/openapi.json` under the `/api` prefix (validation failures → 422 in the contract's
  `ValidationError` shape); `src/db/` — `node:sqlite` + an ordered-SQL migration runner (`PRAGMA user_version`,
  one transaction at startup; `.sql` files in `src/db/migrations`, copied to `dist` by the build);
  `src/services/` — hand-written handlers, one per operationId, assembled by `createServiceHandlers(db)` in
  `src/services/index.ts`, typed with the generated types. `src/index.ts` — startup on `PORT ?? 8000`.
  Tests — Vitest via `app.inject()` with `dbPath: ":memory:"`, located in `server/test/`.
- `web/` — Vite 6 + React 19 + Mantine 9 + react-router (client routes `/`, `/login`, `/owner/:email`,
  `/book/:email`, `/book/:email/:id`; pages in `src/pages/`, copy in `src/content/`, `src/api.ts` — the typed API client).
  Dev proxy `/api` → :8000 (`vite.config.ts`).
- Production: a single process (`npm start`) serves both the API (`/api/*`) and static files from `web/dist` — there is no separate frontend server. Client routes get the SPA fallback (`index.html`); unknown `/api/*` stays JSON 404.
- Time — UTC ISO 8601 strings only; a slot is exactly 30 minutes, `start` aligned to `:00`/`:30`.
- DB — SQLite via `node:sqlite`, file `data/app.db` (default path is resolved from the repo root, so cwd does not matter). Requires local Node ≥ 22.13 (unflagged `node:sqlite`; the process prints an ExperimentalWarning on Node 22 — expected). `data/` is in .gitignore.
- `docs/reference/` — local design reference screenshots (e.g. for the landing page). Gitignored; never commit its contents.
- `docs/ui-style.md` — the approved visual contract (from the landing page) that every new page follows.
- `docs/specs/` — feature specifications (SDD: the spec is written and merged before implementation).

## Commands

- `make setup` — `npm ci` (requires Node ≥ 22.13: `node:sqlite` unflagged; the local default `node`
  may be older, then use Node 22 from nvm: `export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"`)
- `make run` — dev: backend :8000 + frontend :5173 (concurrently)
- `make generate` — regenerate the API artifacts (OpenAPI spec + TS types) from the TypeSpec sources in `contract/`
- `make test` — Vitest; a single test: `npm test -w server -- test/health.test.ts`
- `make lint` — ESLint (flat config at the root, typescript-eslint)
- `make docker-build` / `make docker-run` — image `call-booking`, port 8000

## Version pins (do not upgrade without a reason)

- `vite@6`, `vitest@3`, `@fastify/static@9` are pinned for the local Node 22.11: vite 8 / vitest 4 require
  Node ≥ 22.12 (native rolldown binary), `@fastify/static@10` needs `require(esm)` from Node ≥ 22.12.
  If the local Node is upgraded to ≥ 22.12, the pins can be revisited. CI and Docker use fresh Node 22 — no issue there.
- `jsdom@26` (devDep for web tests, pinned via root `overrides`): jsdom 27's CSS stack `require()`s
  an ESM-only package, which also needs `require(esm)` from Node ≥ 22.12.

## Do not touch

- `.github/workflows/hexlet-check.yml` — auto-generated Hexlet checks file (do not delete, edit, or rename; do not rename the repository either).
- In README — the hexlet-check badge and the "Автоматические тесты Хекслета" section.

## Conventions

- Commits and PR titles — Conventional Commits only, messages in English: release-please builds the changelog
  and version from them. Load the `conventional-commits` skill (`.opencode/skills/conventional-commits/`) before committing.
- All documentation (AGENTS.md, README, `docs/`, skills) and commit messages — in English.
  Conversation with the user and UI texts — in Russian.
- Dependencies — via `npm install <pkg> -w contract|-w server|-w web` (dev: `-D`); the root `package-lock.json`
  is committed — needed for reproducible builds (`npm ci` in CI and Docker).
- CI: `.github/workflows/ci.yml` runs lint + test + build on every push; `release-please.yml` maintains a release PR on `main`.

## Agent skills

### Issue tracker

GitHub Issues on `Pir-4/ai-for-developers-project-386`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
