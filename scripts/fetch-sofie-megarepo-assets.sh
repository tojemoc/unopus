#!/usr/bin/env bash
# Fetch canonical sofie megarepo assets/ for standalone CI / local use.
# Pins an immutable commit SHA and verifies SHA-256 checksums before export.
# Writes SOFIE_MEGAREPO_ASSETS to $GITHUB_ENV when present.
set -euo pipefail

DEST="${1:-${GITHUB_WORKSPACE:-.}/.sofie-assets}"
mkdir -p "$DEST"

# Immutable pin: tojemoc/sofie@cdc2d3b6 (assets landed via #13). Bump SHA + checksums together.
SOFIE_ASSETS_REF="${SOFIE_ASSETS_REF:-cdc2d3b66407e920159a1f5772c616d0056ca990}"
BASE="https://raw.githubusercontent.com/tojemoc/sofie/${SOFIE_ASSETS_REF}/assets"

# filename → expected sha256 (of the pinned commit's assets/)
declare -A EXPECTED_SHA256=(
	[spravy-v3-smoke-rundown.json]=ff09e57f79b8b6d1015850009380393de6bf4b0a4a44e12508c3cd3b8c54fd1c
	[sofie-rundown-editor-piece-types.json]=186f8b188a88d96106ca20666b9ddf54005e1bb0920d405a2b8cf7b6ad80fdbb
	[sofie-rundown-editor-part-types.json]=d6c75f6cfc64a653418369f5bf1c2884cfdcdae3e9d138705bb175cd4f7f6838
	[sofie-rundown-editor-segment-types.json]=56f68da340a1029f4c31a1f69b6594e5d440f1e7223528cd2ce9dbaa8c1aaf7b
)

FILES=(
	spravy-v3-smoke-rundown.json
	sofie-rundown-editor-piece-types.json
	sofie-rundown-editor-part-types.json
	sofie-rundown-editor-segment-types.json
)

cleanup_partial() {
	for f in "${FILES[@]}"; do
		rm -f "$DEST/$f"
	done
}

for f in "${FILES[@]}"; do
	if ! curl -fsSL -o "$DEST/$f" "$BASE/$f"; then
		echo "Failed to download $f from sofie@${SOFIE_ASSETS_REF}" >&2
		cleanup_partial
		exit 1
	fi
	actual="$(sha256sum "$DEST/$f" | awk '{print $1}')"
	expected="${EXPECTED_SHA256[$f]}"
	if [[ "$actual" != "$expected" ]]; then
		echo "Checksum mismatch for $f (sofie@${SOFIE_ASSETS_REF})" >&2
		echo "  expected: $expected" >&2
		echo "  actual:   $actual" >&2
		cleanup_partial
		exit 1
	fi
done

if [ -n "${GITHUB_ENV:-}" ]; then
	echo "SOFIE_MEGAREPO_ASSETS=$DEST" >>"$GITHUB_ENV"
fi
export SOFIE_MEGAREPO_ASSETS="$DEST"
echo "Fetched and verified sofie megarepo assets from ${SOFIE_ASSETS_REF} into $DEST"
