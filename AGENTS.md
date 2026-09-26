# AGENTS.md

## Project

"Call booking" — a Hexlet learning project (ai-for-developers program): a simplified Cal.com.
The owner publishes 30-minute slots, a guest books a slot, the owner views the list of upcoming meetings.

Deliberately **out of scope** (do not add): authentication, personal accounts, external calendar integrations.
Behavior reference — video in README: https://files.hexlet.app/a/2ipc5m

## Workflow

- Development in stages, contract-first: contract (`docs/api.md`) → frontend → backend → scenario tests → deploy.
  Do not skip stages unless the user explicitly asks.
- `docs/api.md` is the source of truth. Changing API behavior = edit the contract first, then the code.
- Final readiness criterion: the image builds and runs (`make docker-build && make docker-run`).
- Only the agent writes code; the user does not edit code by hand.

## Stack and structure

- Node.js 22+, TypeScript (strict, ESM/NodeNext), npm workspaces: `server/` and `web/`.
- `server/` — Fastify 5. `src/app.ts` — `buildApp()` (routes, plugins), `src/index.ts` — startup on `PORT ?? 8000`.
  Tests — Vitest via `app.inject()`, located in `server/test/`.
- `web/` — Vite 6 + React 19 + Mantine 9. Dev proxy `/api` → :8000 (`vite.config.ts`).
- Production: a single process (`npm start`) serves both the API (`/api/*`) and static files from `web/dist` — there is no separate frontend server.
- Time — UTC ISO 8601 strings only; a slot is exactly 30 minutes, `start` aligned to `:00`/`:30`.
- DB — SQLite, file `data/app.db`; arrives at the backend stage, not present in the code yet. `data/` is in .gitignore.

## Commands

- `make setup` — `npm ci` (requires Node ≥ 22; the local default `node` may be 20, then use Node 22
  from nvm: `export PATH="$HOME/.nvm/versions/node/v22.11.0/bin:$PATH"`)
- `make run` — dev: backend :8000 + frontend :5173 (concurrently)
- `make test` — Vitest; a single test: `npm test -w server -- test/health.test.ts`
- `make lint` — ESLint (flat config at the root, typescript-eslint)
- `make docker-build` / `make docker-run` — image `call-booking`, port 8000

## Version pins (do not upgrade without a reason)

- `vite@6`, `vitest@3`, `@fastify/static@9` are pinned for the local Node 22.11: vite 8 / vitest 4 require
  Node ≥ 22.12 (native rolldown binary), `@fastify/static@10` needs `require(esm)` from Node ≥ 22.12.
  If the local Node is upgraded to ≥ 22.12, the pins can be revisited. CI and Docker use fresh Node 22 — no issue there.

## Do not touch

- `.github/workflows/hexlet-check.yml` — auto-generated Hexlet checks file (do not delete, edit, or rename; do not rename the repository either).
- In README — the hexlet-check badge and the "Автоматические тесты Хекслета" section.

## Conventions

- Commits and PR titles — Conventional Commits only, messages in English: release-please builds the changelog
  and version from them. Load the `conventional-commits` skill (`.opencode/skills/conventional-commits/`) before committing.
- All documentation (AGENTS.md, README, `docs/`, skills) and commit messages — in English.
  Conversation with the user and UI texts — in Russian.
- Dependencies — via `npm install <pkg> -w server|-w web` (dev: `-D`); the root `package-lock.json`
  is committed — needed for reproducible builds (`npm ci` in CI and Docker).
- CI: `.github/workflows/ci.yml` runs lint + test + build on every push; `release-please.yml` maintains a release PR on `main`.
