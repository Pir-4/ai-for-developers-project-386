# Research: SQLite access from Fastify on Node 22

Resolves GitHub issue #11 (part of the wayfinder map #7, blocks #16).
Date: 2026-10-04. All claims cite primary sources (see [Sources](#sources)).

## Context and constraints

- Server: Fastify 5, TypeScript strict, ESM/NodeNext, npm workspaces.
- Runtime versions: local dev historically pinned to Node **22.11.0** via nvm; CI and Docker use latest Node 22 (Dockerfile base: `node:22-bookworm-slim`).
- DB: SQLite, single file `data/app.db` (gitignored), embedded in the one production container (`npm start` serves API + static files). No separate DB service.
- Tests: Vitest via `app.inject()`; the DB layer must be cheap to instantiate per test.
- Project scope is small: two tables (slots, bookings) per the contract in `docs/api.md`.

## Option A: built-in `node:sqlite`

### Status timeline (from the Node.js v22 changelog, primary source)

| Milestone | Version | Date |
| --- | --- | --- |
| Module added, behind `--experimental-sqlite` | 22.5.0 | 2024-07-17 |
| **Unflagged** — "doc,lib,src,test: unflag sqlite module" (PR #55890) | **22.13.0** | 2025-01-07 |
| `iterate()`, `constants`, custom functions, extensions | 22.13.0–22.14.0 | 2025-01/02 |
| `isOpen`, `Symbol.dispose`, unknown named params | 22.15.0 | 2025-04-23 |
| `aggregate()`, `location()`, `isTransaction`, `columns()`, `setReturnArrays()`, `sqlite.backup()` | 22.16.0 | 2025-05-21 |
| Latest 22.x at time of writing | 22.23.3 | 2026-09-23 |

Stability index: **1.1 "Active development"** on the whole v22 line (v22.23.3 docs); **1.2 "Release candidate"** on current Node (v26.x docs). The v22.x `lib/sqlite.js` unconditionally calls `emitExperimentalWarning('SQLite')`, so every process that loads it prints
`ExperimentalWarning: SQLite is an experimental feature and might change at any time`.

### Flag requirement — verified empirically on this machine

- Node **22.11.0** (the old local pin): `require('node:sqlite')` **fails** with `ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite`. With `--experimental-sqlite` it works and prints the ExperimentalWarning.
- Node **22.23.3** (latest 22.x): works with no flag (the CLI docs for latest v22 only list the *disabling* `--no-experimental-sqlite` flag).
- Consequence: adopting `node:sqlite` requires local dev on Node **≥ 22.13** (bump the nvm-installed version), or passing `--experimental-sqlite` via `NODE_OPTIONS` to tsx/vitest on 22.11. CI and Docker need nothing — they already run latest 22.

### API surface (v22 docs)

Synchronous only, two classes: `DatabaseSync` (`exec`, `prepare`, `open`/`close`, `function`, `aggregate`, `location`, `loadExtension`, `isOpen`, `isTransaction`, `Symbol.dispose`, session/changeset API) and `StatementSync` (`run` → `{ changes, lastInsertRowid }`, `get`, `all`, `iterate`, `setReadBigInts`, `expandedSQL`/`sourceSQL`, …). Plus `sqlite.backup()` and `sqlite.constants`. In-memory databases via the special path `':memory:'`. Foreign keys are **on by default** (`enableForeignKeyConstraints` default `true`).

- ESM: it is a builtin — `import { DatabaseSync } from 'node:sqlite'`; no package, no interop concerns.
- Typing: ships with `@types/node` (`types/node/sqlite.d.ts` on DefinitelyTyped master). Caveat: the repo currently has `@types/node@^26`; its `sqlite.d.ts` tags some options as `@since v24`/`v25` (e.g. `timeout`, `limits`) even where v22.16+ backports exist. The core API used here (`exec`/`prepare`/`run`/`get`/`all`) is `@since v22.5.0` and identical. If exactness is wanted, pin `@types/node@^22` in `server/`.
- Docker: zero impact — nothing to install, no native code, `npm ci` unchanged, image unchanged.
- Migrations: **none built in** — DIY (see recommendation below).
- Maintenance: Node core; the v22 changelog shows continuous `sqlite:` commits and SQLite dependency bumps through 2026.

## Option B: `better-sqlite3`

- Latest: **13.0.3** (2026-08-05), `engines: node >= 22`. Active maintenance (WiseLibs, regular releases through 2026).
- **v13.0.0 (2026-07-21) rewrote the addon to N-API** (`node-addon-api`), dropped `prebuild-install`, and now ships prebuilt binaries **inside the npm tarball** (`prebuilds/{darwin,linux,linuxmusl,win32}-{x64,arm64}.node` — verified by listing the 13.0.3 tarball). glibc **and musl (Alpine)** are both covered, so no compiler toolchain is needed on either of our Docker base variants; unsupported platforms fall back to a `node-gyp` source build (needs python3/make/g++). v12.x instead downloaded prebuilds from GitHub release assets at install time (138 assets on v12.11.1).
- ESM: CommonJS package; the README documents default-import interop: `import Database from 'better-sqlite3'`.
- Typing: community `@types/better-sqlite3` (9.6.0).
- API: synchronous, very close in shape to `node:sqlite` (`prepare().run/get/all`), plus conveniences `db.pragma()`, `db.transaction(fn)`, `db.backup()`. README recommends enabling WAL.
- Migrations: none built in.
- Docker: works (in-tarball prebuilds), but adds a dependency and a native `.node` file to the image; supply-chain and rebuild-on-fallback considerations that `node:sqlite` simply does not have.

## Option C: Drizzle ORM (over a driver)

- Stable `drizzle-orm@0.45.3` (2026-09-21). Its export map has SQLite drivers for `better-sqlite3`, `libsql`, `bun-sqlite`, `expo-sqlite`, `op-sqlite`, D1/Durable Objects, `sqlite-proxy` — **no `node:sqlite` driver in stable** (verified against the 0.45.3 export map).
- A native `node:sqlite` driver (`drizzle-orm/node-sqlite`, incl. `./node-sqlite/migrator`) exists only on the **v1 release candidate** line (`drizzle-orm@rc` = 1.0.0-rc.4; the docs site documents the RC and installs via `drizzle-orm@rc`). Pinning a learning project to an RC is not attractive.
- Migrations: `drizzle-kit` (0.31.11) — schema in TS, `generate` emits SQL files, `migrate` applies them. Real but heavyweight tooling: an extra dev dependency, a `drizzle.config.ts`, and a codegen step.
- Typing: excellent (schema declared in TS, inferred row types).
- Verdict here: ORM + kit + (better-sqlite3 driver or an RC) is disproportionate for two tables.

## Option D: Kysely (over a driver)

- `kysely@0.29.6` (2026-09-16), still 0.x, actively maintained.
- The **core `SqliteDialect` wraps `better-sqlite3`** (API docs: "SQLite dialect that uses the better-sqlite3 library"; you install the driver yourself). `node:sqlite` support exists only as a **community dialect** (`wolfie/kysely-node-native-sqlite` listed on the dialects page) — an extra, lightly-used dependency.
- Migrations: best-in-class built-in story — `Migrator` + `FileMigrationProvider` from `kysely/migration`, `migrateToLatest()`, DB-level locking so concurrent instances migrate once; optional `kysely-ctl` CLI.
- Typing: excellent type-safe query builder; row types are hand-written interfaces or generated with `kysely-codegen`.
- Verdict here: inherits the better-sqlite3 native dependency (or a community dialect), and a query builder is more machinery than the contract needs.

## Comparison table

| Criterion | `node:sqlite` | `better-sqlite3` | Drizzle | Kysely |
| --- | --- | --- | --- | --- |
| New runtime deps | 0 | 1 (+`@types/`) | orm + kit (+driver) | kysely (+driver) |
| ESM | builtin | CJS + default-import interop | ESM/CJS dual | ESM/CJS dual |
| Native binary | none (in Node) | yes; v13 prebuilds in tarball incl. musl, N-API | via driver | via driver |
| Docker impact | none | none with prebuild; toolchain only on exotic platforms | via driver | via driver |
| TS typing | `@types/node` (official) | `@types/better-sqlite3` (community) | best (schema in TS) | best (typed builder) |
| Migrations | DIY | DIY | drizzle-kit generate/migrate | built-in Migrator |
| Maturity/maintenance | Node core, Stability 1.1 on 22 / 1.2 on 26; ExperimentalWarning on 22 | v13.0.3, very active | stable 0.45.x; node:sqlite only in v1 RC | 0.29.6, active |
| Node 22.11 local pin | needs `--experimental-sqlite` | works | works | works |
| Node 22-latest (CI/Docker) | works, no flag | works | works | works |

## Test story

Goal: `app.inject()` tests with a real schema and zero fixtures.

- Make `buildApp()` accept a DB location (e.g. `buildApp({ dbPath })`, default `data/app.db`).
- Tests pass `':memory:'`: each app instance gets a private, empty database — perfect isolation between test files regardless of Vitest's pool, no temp files to clean up, no Docker needed. Both `node:sqlite` and `better-sqlite3` support `':memory:'`.
- Schema setup must run inside app construction (not in a separate CLI script) so tests exercise the same code path as production first-run.
- Vitest runs under Node directly, so the 22.11 flag caveat applies to `npm test` locally too until the local Node is ≥ 22.13.

## First-run and Docker behavior

- Startup sequence (in `buildApp`): `mkdirSync('data', { recursive: true })` → open `DatabaseSync(dbPath)` → `PRAGMA journal_mode = WAL;` → run pending migrations → register routes. Fail fast if any step throws.
- `data/` is gitignored and is not copied into the image (`.dockerignore`/selective COPYs), so every fresh container starts with schema creation — exactly what we want for the deliverable (`make docker-build && make docker-run` must just work).
- **What a volume buys** (`docker run -v call-booking-data:/app/data …`): meetings survive container recreation (`docker rm` → `docker run`), i.e. persistence across deploys/restarts of the container. Without a volume the DB lives in the container's writable layer and is discarded with it — acceptable for the learning project, worth one line in the README. A volume is also what would make host-side backups of `app.db` trivial.

## Recommendation

**Use built-in `node:sqlite` with hand-written SQL and a tiny migration runner.**

Why:

1. **Zero dependencies.** The lockfile, `npm ci` reproducibility, the Docker image, and the supply chain stay exactly as they are. No native binaries anywhere — the one thing that historically made SQLite-on-Node painful in Docker.
2. **Fits the runtime matrix.** CI/Docker run latest Node 22 where the module is unflagged; the only change needed is local dev on Node ≥ 22.13 (install latest 22 via nvm; the existing vite/vitest/@fastify/static pins remain valid — they only gate upgrading *to* versions requiring ≥ 22.12).
3. **Right-sized.** The contract needs two tables and simple queries; `exec` + prepared `run/get/all` cover it. An ORM/query builder adds deps and tooling without paying off at this scope; Drizzle's `node:sqlite` driver isn't even in stable yet.
4. **Risk is contained.** The module is experimental on 22 (Stability 1.1, prints an ExperimentalWarning) but the API we need has been stable since 22.5 and the module is a release candidate on current Node. The DB layer will be one small module, so a future swap to `better-sqlite3` (whose API is nearly identical) is cheap.

### How schema creation / migrations should work

- Keep ordered SQL migration files: `server/src/db/migrations/001_slots.sql`, `002_bookings.sql`, …
- On startup, in a transaction: read `PRAGMA user_version`, apply every migration with a higher number (each file `db.exec(...)`'d, then bump `user_version`). This is ~40 lines, dependency-free, idempotent, and safe to run from every process start (including each test's `:memory:` database).
- First migration is plain `CREATE TABLE slots …; CREATE TABLE bookings …;` derived from `docs/api.md`. `CREATE TABLE IF NOT EXISTS` is fine too, but the `user_version` runner costs nothing and is the pattern we will want the moment a column changes.

Concretely for the follow-up ticket (#16): add `server/src/db/` (open + migrate + typed row mappers), thread `dbPath` through `buildApp()`, default `data/app.db`, tests on `':memory:'`, and update AGENTS.md's setup note to require Node ≥ 22.13 locally.

## Sources

- Node.js v22 API docs, SQLite (stability 1.1, API surface, `:memory:`, defaults): https://nodejs.org/docs/latest-v22.x/api/sqlite.html
- Node.js current API docs, SQLite (stability 1.2 "Release candidate"): https://nodejs.org/docs/latest/api/sqlite.html
- Node.js v22 CLI docs (`--no-experimental-sqlite` is the only flag on latest v22): https://nodejs.org/docs/latest-v22.x/api/cli.html
- Node.js CHANGELOG_V22 (added 22.5.0; unflagged in 22.13.0 via PR #55890; 22.13–22.16 additions; 22.23.3 latest): https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V22.md
- `lib/sqlite.js` on v22.x (unconditional `emitExperimentalWarning('SQLite')`): https://github.com/nodejs/node/blob/v22.x/lib/sqlite.js
- Local empirical check on Node 22.11.0: `ERR_UNKNOWN_BUILTIN_MODULE` without flag; works with `--experimental-sqlite` + ExperimentalWarning.
- better-sqlite3 README (ESM import, WAL advice, prebuilds statement): https://github.com/WiseLibs/better-sqlite3
- better-sqlite3 v13.0.0 release notes (N-API rewrite, prebuilds shipped in the npm package, prebuild-install removed): https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0
- better-sqlite3 v12.11.1 release assets (prebuild-install era, 138 assets): https://github.com/WiseLibs/better-sqlite3/releases/tag/v12.11.1
- npm registry metadata: `better-sqlite3@13.0.3` (engines `>=22`, deps `node-addon-api`, tarball contains `prebuilds/linuxmusl-*.node` etc.), `@types/better-sqlite3@9.6.0`, `drizzle-orm@0.45.3` export map (no `./node-sqlite`), `drizzle-orm@rc = 1.0.0-rc.4` export map (`./node-sqlite`, `./node-sqlite/migrator`), `drizzle-kit@0.31.11`, `kysely@0.29.6` exports (incl. `./migration`).
- Drizzle docs, "Drizzle <> Node SQLite" (v1 RC; sync and async APIs over `node:sqlite`): https://orm.drizzle.team/docs/connect-node-sqlite
- Kysely dialects page (core SQLite dialect; Node SQLite only as community dialect): https://kysely.dev/docs/dialects
- Kysely SqliteDialect API docs ("uses the better-sqlite3 library"): https://kysely-org.github.io/kysely-apidoc/classes/SqliteDialect.html
- Kysely migrations docs (Migrator, FileMigrationProvider, locking): https://kysely.dev/docs/migrations
- DefinitelyTyped `types/node/sqlite.d.ts` (`declare module "node:sqlite"`, `@since` tags): https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/node/sqlite.d.ts
