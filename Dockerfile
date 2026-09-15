# ---------- Build Stage ----------
FROM node:22-slim AS builder

# Set production environment
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# Set working directory
WORKDIR /app

# Enable Corepack and prepare Yarn 4
RUN corepack enable && corepack prepare yarn@4.9.1 --activate

# Copy the entire repo
COPY . .

# Install all dependencies (incl. devDeps)
RUN yarn install --frozen-lockfile

# Canonical type manifests live in tojemoc/sofie assets/ (not this repo).
# fetch-sofie-megarepo-assets.sh pins an immutable commit SHA and verifies SHA-256s.
#
# ffmpeg (ffprobe) stays in the image: media picker / Source length / VO-VT timing
# spawn `ffprobe`. Without it, probes fail silently and On air is never seeded from clip length.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates ffmpeg \
	&& bash scripts/fetch-sofie-megarepo-assets.sh /app/.sofie-assets \
	&& apt-get purge -y curl \
	&& apt-get autoremove -y \
	&& rm -rf /var/lib/apt/lists/* \
	&& command -v ffprobe >/dev/null
ENV SOFIE_MEGAREPO_ASSETS=/app/.sofie-assets

# Build the app
RUN yarn build

RUN mkdir /app/data && chown -R node:node /app /app/data

USER node

# Default command (adjust as needed)
CMD ["yarn", "start"]

EXPOSE 3010/tcp