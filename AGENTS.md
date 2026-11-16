# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Sofie Rundown Editor is a web app for creating/editing broadcast rundowns. It has two workspaces:
- **backend** (Express + Socket.IO on port 3010) — uses embedded SQLite via `node:sqlite`
- **frontend** (React 19 + Vite on port 5173)

### Running the application

```bash
yarn dev          # starts both backend and frontend concurrently
yarn dev:backend  # backend only (port 3010, uses nodemon for hot-reload)
yarn dev:ui       # frontend only (Vite, port 5173)
```

The backend requires a `.env` file in the `backend/` directory. Copy from `.env.example` if it doesn't exist:
```bash
cp backend/.env.example backend/.env
```

### Key caveats

- The backend connects to Sofie Core at `127.0.0.1:3000` by default. "Core Initialization Error: connect ECONNREFUSED" messages are normal when Sofie Core is not running — the app is fully usable without it.
- SQLite is experimental in Node.js 22; the `ExperimentalWarning` log is expected and harmless.
- The backend's nodemon config rebuilds TypeScript before restarting (`run build:main && node ./dist/main.js`). After editing backend source, wait a moment for the rebuild cycle.
- The frontend proxies Socket.IO to the backend. Both must be running for full functionality.

### Lint / Build / Test

Standard commands (see `package.json` scripts):
```
yarn typecheck   # tsc --noEmit / tsc -b (no Vite emit)
yarn lint        # ESLint across all workspaces
yarn build       # TypeScript emit + Vite production build
```

CI (`.github/workflows/node.yaml`): PRs run `typecheck` + `lint` only; `yarn build`
runs on pushes to `main`. Docker/GitHub releases stay in `release.yaml` (main + `v*` tags).
**`yarn test` is not run in CI.**

Backend/frontend unit tests exist (Node test runner via `yarn test`, including
`backend/src/background/media.test.ts` for ffprobe duration heuristics). Run them
locally when touching those areas.

### ffprobe / clip duration (Docker)

Media picker and `GET /api/media/duration` shell out to **`ffprobe`**. The production
`Dockerfile` installs the Debian **`ffmpeg`** package so `ffprobe` is on PATH. Without it,
probes fail silently (`durationSeconds: null`) and On air is never seeded from clip length.
Startup logs `ffprobe: available` or a warning. Dev hosts usually already have ffmpeg via apt.

### Pre-commit hooks

Husky runs `lint-staged` on commit, which applies Prettier to `*.{js,css,json,md,scss}` and runs `yarn lint-fix` on `*.{ts,tsx,cts}`.

### Shared type manifests & smoke rundown (not in this repo)

**Canonical home:** [`tojemoc/sofie` → `assets/`](https://github.com/tojemoc/sofie/tree/main/assets)

| File | Purpose |
|------|---------|
| `sofie-rundown-editor-piece-types.json` | Piece types + GFX preview templates |
| `sofie-rundown-editor-part-types.json` | Part presets |
| `sofie-rundown-editor-segment-types.json` | Segment presets |
| `spravy-v3-smoke-rundown.json` | Smoke rundown (`spravy-v3-smoke`) |

Do **not** reintroduce these under `assets/` in this repo. Backend `manifest.ts` resolves them
from the megarepo when this clone is nested as `sofie/rundown-editor/`, or via
`SOFIE_MEGAREPO_ASSETS` (set by `scripts/fetch-sofie-megarepo-assets.sh` in CI / Docker).
Reload in the UI: **Settings → Connection → Reload type manifests** (fully replaces by
entity type + id; optionally remove types not in assets). Per-page **Delete all** is also
available under Settings → Piece/Part/Segment Types.

**Part/piece id collision:** Part type `intro` and piece type `intro` share the same id by
design. The DB primary key is `(id, entityType)` so both can coexist. After upgrading, use
**Reload type manifests** so the missing Intro overlay piece type is inserted.

#### Fetch trust model (CI / Docker)

`scripts/fetch-sofie-megarepo-assets.sh` must **not** use mutable refs (`main`, `cursor/…`).
It pins `tojemoc/sofie` to an immutable commit SHA and verifies each file’s SHA-256 before
exporting `SOFIE_MEGAREPO_ASSETS`. Mismatch → exit 1 and delete partial downloads.

| Knob | Purpose |
|------|---------|
| Default `SOFIE_ASSETS_REF` | Pinned sofie commit (currently `02258259…`, smoke rundown synced with `Export rundown.json`) |
| `EXPECTED_SHA256` map | Per-file integrity for that pin |
| `$GITHUB_ENV` | CI persistence of `SOFIE_MEGAREPO_ASSETS` |

**Bump procedure** (when megarepo `assets/` changes): update `SOFIE_ASSETS_REF` **and** every
checksum in the same commit (`git show <sha>:assets/<file> \| sha256sum`). Do not bump the
ref alone. Megarepo contract:
[MEGAREPO-ASSETS-FETCH.md](https://github.com/tojemoc/sofie/blob/main/docs/integration/MEGAREPO-ASSETS-FETCH.md).

### Auth & roles

- Local accounts in SQLite (`authStore.ts`): scrypt-hashed passwords, `timingSafeEqual`,
  UUID session ids, `HttpOnly` + `SameSite=Strict` cookies (`Secure` behind
  `SESSION_COOKIE_SECURE`).
- Roles: `admin` / `editor` / `viewer`. Socket mutations go through `forbidRundownMutation`
  (`backend/src/socketServer.ts`); REST routes mostly check only that a session exists —
  **known gap**: `settings` and `typeManifests` socket channels, and mutation REST routes
  (daily-generation, weather sync, media ensure-folder) lack role checks. Treat any new
  mutation endpoint as needing an explicit role gate until those are fixed.
- Socket.IO authenticates via the session cookie in middleware; `socketServer.ts` logs every
  event **with its full payload** — don't add secrets to event payloads until that log is
  trimmed (settings updates carry `imeteoApiKey`).

### Core contract

The backend is a Sofie **peripheral device** (`background/coreHandler.ts`): connects over DDP
to `coreUrl:corePort` (default `127.0.0.1:3000`), device id + token from settings (defaults
`SofieRundownEditor` / `unsecureToken` — always configure for real deployments; the retry loop
re-registers connection listeners each second Core is down). Rundowns marked `sync=true` are
pushed via `dataRundownCreate`/`dataRundownUpdate`/`dataRundownDelete` and part/piece
mutations via `dataPart*`/`dataSegment*`/`dataPiece*` ingest methods using **externalIds**
(RE ids == Sofie `externalId`). Part ids double as `Part.externalId` for the on-air lock.

Consumes fork-added Core methods: `getContentStatusForRundown` (media readiness),
`getRundownPlayoutState` + `getRundownPartAutoNext` (On-air System locks via
`playoutLockService` — polled; **advisory only, the backend does not enforce locks on
mutations**).

### Data flow

REST = session/admin APIs (`/api/...`); Socket.IO = live rundown CRUD + Core sync. Rundown
docs are JSON rows in SQLite tables (`rundowns`, `segments`, `parts`, `pieces`) keyed by
`(id, entityType)` for type manifests. Deletes wrap multi-table deletes in `BEGIN…COMMIT` —
**the `catch` paths lack `ROLLBACK`** (unlike `reorder`); if you touch deletes, fix that first.
Full end-to-end schema: megarepo `docs/integration/RUNDOWN-SCHEMA-AND-LAYOUT.md`.
