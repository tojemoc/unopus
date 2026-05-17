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
