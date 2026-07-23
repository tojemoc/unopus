#!/usr/bin/env bash
# Fetch canonical sofie megarepo assets/ for standalone CI / local use.
#
# Trust model (do not regress to mutable refs):
#   - Pin downloads to an immutable tojemoc/sofie commit SHA (never main / cursor/…).
#   - Verify each file's SHA-256 against EXPECTED_SHA256 before exporting.
#   - On download or checksum failure: delete partial files and exit 1.
#
# Bump: set SOFIE_ASSETS_REF default + every EXPECTED_SHA256 entry in the same commit.
#   git show <sha>:assets/<file>.json | sha256sum
# Contract: https://github.com/tojemoc/sofie/blob/main/docs/integration/MEGAREPO-ASSETS-FETCH.md
#
# Writes SOFIE_MEGAREPO_ASSETS to $GITHUB_ENV when present; also exports in this shell.
set -euo pipefail

DEST="${1:-${GITHUB_WORKSPACE:-.}/.sofie-assets}"
mkdir -p "$DEST"
DEST="$(cd "$DEST" && pwd)"

# Immutable pin: tojemoc/sofie@7c67e3a8 (ILU prerendered/bypass). Bump SHA + checksums together.
# Reject mutable overrides (main, tags, short SHAs). Only a full 40-char commit SHA is allowed.
PINNED_SOFIE_ASSETS_REF="7c67e3a83f4856c827a5a22b742d8d7d03d04a89"
SOFIE_ASSETS_REF="${SOFIE_ASSETS_REF:-$PINNED_SOFIE_ASSETS_REF}"
if [[ ! "$SOFIE_ASSETS_REF" =~ ^[0-9a-f]{40}$ ]]; then
	echo "SOFIE_ASSETS_REF must be a full 40-char lowercase commit SHA (got: ${SOFIE_ASSETS_REF})" >&2
	exit 1
fi
BASE="https://raw.githubusercontent.com/tojemoc/sofie/${SOFIE_ASSETS_REF}/assets"

# filename → expected sha256 (of the pinned commit's assets/)
declare -A EXPECTED_SHA256=(
	[spravy-v3-smoke-rundown.json]=8ca16c85df0869a307a86ded2e2758b411346932f115cd94c3ee7b9413a7c3ac
	[sofie-rundown-editor-piece-types.json]=a59537bac8b146965812b170d288135758ce8e87707def1a2ca40ec4954bdee3
	[sofie-rundown-editor-part-types.json]=e671542921acdb7397904172168e8ccf62a53c715ee0be131a5d48c4247242e5
	[sofie-rundown-editor-segment-types.json]=56f68da340a1029f4c31a1f69b6594e5d440f1e7223528cd2ce9dbaa8c1aaf7b
)

FILES=(
	spravy-v3-smoke-rundown.json
	sofie-rundown-editor-piece-types.json
	sofie-rundown-editor-part-types.json
	sofie-rundown-editor-segment-types.json
)

# Stage under DEST so a failed/interrupted fetch never clobbers a prior valid set.
STAGE="$(mktemp -d "${DEST}/.fetch-XXXXXX")"
cleanup_partial() {
	rm -rf "${STAGE}"
}
trap 'cleanup_partial' EXIT INT TERM

for f in "${FILES[@]}"; do
	if ! curl -fsSL --connect-timeout 15 --max-time 120 -o "$STAGE/$f" "$BASE/$f"; then
		echo "Failed to download $f from sofie@${SOFIE_ASSETS_REF}" >&2
		cleanup_partial
		exit 1
	fi
	actual="$(sha256sum "$STAGE/$f" | awk '{print $1}')"
	expected="${EXPECTED_SHA256[$f]}"
	if [[ "$actual" != "$expected" ]]; then
		echo "Checksum mismatch for $f (sofie@${SOFIE_ASSETS_REF})" >&2
		echo "  expected: $expected" >&2
		echo "  actual:   $actual" >&2
		cleanup_partial
		exit 1
	fi
done

for f in "${FILES[@]}"; do
	mv -f "$STAGE/$f" "$DEST/$f"
done

trap - EXIT INT TERM
cleanup_partial

if [ -n "${GITHUB_ENV:-}" ]; then
	echo "SOFIE_MEGAREPO_ASSETS=$DEST" >>"$GITHUB_ENV"
fi
export SOFIE_MEGAREPO_ASSETS="$DEST"
echo "Fetched and verified sofie megarepo assets from ${SOFIE_ASSETS_REF} into $DEST"
