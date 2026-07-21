# Sofie Rundown Editor

> A tool for creating and editing rundowns in a _demo_ environment of [Sofie](https://github.com/Sofie-Automation/Sofie-TV-automation/).

![App preview image](docs/app-preview-image.png)

## Prerequisites

Sofie Rundown Editor requires that you have a working instance of [Sofie Core](https://github.com/Sofie-Automation/sofie-core) release 53 with the [demo blueprints](https://github.com/SuperFlyTV/sofie-demo-blueprints) uploaded to it. You do not need to install the [spreadsheet-gateway](https://github.com/SuperFlyTV/spreadsheet-gateway).

## Installation

Deploy the docker container using the `docker-compose.yml`, modify the port, volume mapping as needed. When migrating from a local install, the `data.db` file should be copied to the directory which the data volume points to otherwise the container will initialize a new database on the first run.

Once up and running in Rundown Editor go to `Settings -> Core Connection` and set the address and port of your Sofie instance. This is stored in your database file.

## Usage (Quick Start / Demo)

1. Begin by navigating to the Settings page in the top right.
2. Enter the URL and port of your Sofie instance (defaults to `127.0.0.1:3000`).
3. Click "Save".
4. Download and import [piece types from the sofie megarepo](https://raw.githubusercontent.com/tojemoc/sofie/main/assets/sofie-rundown-editor-piece-types.json) (right click and "Save link as...") on the Settings page — or run nested under the megarepo and use **Reload type manifests**.
5. Before continuing, open the Sofie Core interface, navigate to the Settings page, click on your Studio, and attach `sofie-rundown-editor` as a Device by clicking the plus sign (+) under "Attached Devices".
6. Back in Rundown Editor, navigate to the Rundowns page in the top right.
7. Download and import [this demo Rundown](https://github.com/SuperFlyTV/sofie-automation-rundown-editor/raw/main/demo-rundown.json) (right click and "Save link as...")
8. Click on the Rundown and ensure that the "Sync to Sofie" box is checked. Be sure to click Save if you changed the setting.
9. Open the Rundown in Sofie.

> 💡 If at any point you need to re-ingest a rundown (for example, to pick up changes to the blueprints), perform the following procedure:
>
> 1. Ensure that Rundown Editor is running and connected to Sofie Core.
> 2. In the Sofie Core web UI, open the rundown you wish to re-ingest.
> 3. Right click on the header and click "Reload Google Sheet Data" (in a future version of Sofie Core, this will say "Reload Rundown Editor Data")
>
>    ![Reload data image](docs/reload-data.png)

## For Developers

### Project setup

```
yarn install
```

### Compiles and hot-reloads for development

In one terminal

```
yarn dev
```

The frontend with hot-reloads will be available at `http://localhost:5173/`

### Compiles and minifies for production

```
yarn build
```

### Lints and fixes files

```
yarn lint
```

### Piece export regression test

```
yarn workspace @sofie-rundown-editor/backend test
```

## SPRÁVY v3 / ingest contract

Type manifests and the smoke rundown live in the **sofie megarepo**
([`tojemoc/sofie` → `assets/`](https://github.com/tojemoc/sofie/tree/main/assets)):

- `sofie-rundown-editor-piece-types.json`
- `sofie-rundown-editor-part-types.json`
- `sofie-rundown-editor-segment-types.json`
- `spravy-v3-smoke-rundown.json` (external id `spravy-v3-smoke`)

Edit them there only. When this repo is nested as `sofie/rundown-editor/`, the backend
loads them automatically; otherwise set `SOFIE_MEGAREPO_ASSETS`.

**After upgrading**, open **Settings → Connection** and click **Reload type manifests from assets** to upsert built-in piece/part/segment types without removing custom types.

### Media ingest layout

Stage clips under:

```
<INGEST_MEDIA_ROOT>/spravy/<rundownId>/clips/<file>.mp4
```

Set `INGEST_MEDIA_ROOT` in `backend/.env`, or override it in **Settings → Connection**. Paths in piece payloads use POSIX form: `spravy/<rundownId>/clips/<file>.mp4`.

### GFX preview

Preview iframes load templates from `PREVIEW_BASE_URL` (default `http://localhost:3010/demo-assets`). Override in **Settings → Connection** for production template hosts.

The build copies lightweight preview HTML stubs into `frontend/dist/demo-assets/` so they ship with the static bundle. Each piece type with `previewTemplate` loads:

```text
{previewBaseUrl}/{previewTemplate}/index.html?{payload query params}
```

**Production behind nginx:** if nginx serves `frontend/dist` directly, add a location so `/demo-assets/` does not fall through to the SPA `index.html` (which causes MIME type errors on `./assets/*.js`):

```nginx
# Serve GFX preview stubs before the SPA catch-all
location /demo-assets/ {
    alias /path/to/frontend/dist/demo-assets/;
    try_files $uri =404;
}

location / {
    root /path/to/frontend/dist;
    try_files $uri $uri/ /index.html;
}

# API and sockets still proxy to the Node backend on 3010
location /api/ {
    proxy_pass http://127.0.0.1:3010;
}
location /socket.io/ {
    proxy_pass http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Alternatively, proxy all traffic to the Node backend (`yarn start` on port 3010) and skip serving `dist` from nginx.

For **full-fidelity** previews (real Vue templates), run `yarn serve` from `sofie-demo-assets` and set the preview base URL to that host (e.g. `http://192.168.1.115:8080`).

Pieces exported to Sofie use:

```json
{
  "objectType": "<pieceType>",
  "objectTime": 0,
  "attributes": { "...payload": "...", "adlib": false }
}
```

Undefined `start` is treated as timeline position `0`, not AdLib.

### Making a new release

1. Merge everything for the release in main
2. Wait for release-please to open a PR for the changes
3. Make sure the changelog and new version number it proposes are sensible.
   If not, release-please has some commands to adjust that.
4. Merge the PR
5. Wait for the release-please workflow to create the new tag
6. Wait for the workflows to [`Create GitHub Release`](https://github.com/SuperFlyTV/sofie-automation-rundown-editor/actions/workflows/create-release.yaml) action to finish
7. Go to the [releases](https://github.com/SuperFlyTV/sofie-automation-rundown-editor/releases) page and publish the draft release
