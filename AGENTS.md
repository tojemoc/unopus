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
yarn lint         # ESLint across all workspaces
yarn build        # TypeScript + Vite production build
```

No automated test suite exists in this repo.

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
Reload in the UI: **Settings → Connection → Reload type manifests**.

#### Fetch trust model (CI / Docker)

`scripts/fetch-sofie-megarepo-assets.sh` must **not** use mutable refs (`main`, `cursor/…`).
It pins `tojemoc/sofie` to an immutable commit SHA and verifies each file’s SHA-256 before
exporting `SOFIE_MEGAREPO_ASSETS`. Mismatch → exit 1 and delete partial downloads.

| Knob | Purpose |
|------|---------|
| Default `SOFIE_ASSETS_REF` | Pinned sofie commit (currently `cdc2d3b6…`, assets from sofie #13) |
| `EXPECTED_SHA256` map | Per-file integrity for that pin |
| `$GITHUB_ENV` | CI persistence of `SOFIE_MEGAREPO_ASSETS` |

**Bump procedure** (when megarepo `assets/` changes): update `SOFIE_ASSETS_REF` **and** every
checksum in the same commit (`git show <sha>:assets/<file> \| sha256sum`). Do not bump the
ref alone. Megarepo contract:
[MEGAREPO-ASSETS-FETCH.md](https://github.com/tojemoc/sofie/blob/main/docs/integration/MEGAREPO-ASSETS-FETCH.md).
