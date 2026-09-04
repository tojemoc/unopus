#!/usr/bin/env bash
# Exit 0 when Dependencies Check may skip yarn audit / license-validate.
#
# Requires an intentional [ignore-audit] marker in the tip commit:
#   - in the subject line, or
#   - as its own line in the body
# Prose mentions of the marker do not count.
#
# And requires a trusted actor (independent of merely editing the subject):
#   - a GitHub App bot (*[bot]) on a push event (installation write is
#     maintainer-approved), or
#   - a human with admin or maintain permission on this repository
# Unauthorized markers are ignored so normal validation still runs.
set -euo pipefail

has_marker=false
if git log -1 --format=%s | grep -Fq '[ignore-audit]'; then
	has_marker=true
elif git log -1 --format=%b | grep -Fxq '[ignore-audit]'; then
	has_marker=true
fi

if [[ "$has_marker" != true ]]; then
	exit 1
fi

if [[ -z "${GITHUB_ACTOR:-}" ]]; then
	echo "Ignoring [ignore-audit]: missing GITHUB_ACTOR; running validation" >&2
	exit 1
fi

# Push-capable GitHub Apps are installation-trusted by maintainers; they are not
# listed as classic collaborators, so the permission API returns "none".
if [[ "${GITHUB_ACTOR}" == *'[bot]' && "${GITHUB_EVENT_NAME:-}" == 'push' ]]; then
	echo "Skipping audit ([ignore-audit] authorized for GitHub App ${GITHUB_ACTOR} on push)"
	exit 0
fi

if [[ -z "${GITHUB_TOKEN:-}" || -z "${GITHUB_REPOSITORY:-}" ]]; then
	echo "Ignoring [ignore-audit]: missing GitHub auth context; running validation" >&2
	exit 1
fi

actor_enc="$(printf '%s' "${GITHUB_ACTOR}" | jq -sRr @uri)"
perm=""
if ! perm="$(
	curl -fsSL \
		-H "Authorization: Bearer ${GITHUB_TOKEN}" \
		-H "Accept: application/vnd.github+json" \
		-H "X-GitHub-Api-Version: 2022-11-28" \
		"https://api.github.com/repos/${GITHUB_REPOSITORY}/collaborators/${actor_enc}/permission" |
		jq -r '.permission // empty'
)"; then
	echo "Ignoring [ignore-audit]: could not resolve ${GITHUB_ACTOR} permission; running validation" >&2
	exit 1
fi

case "${perm}" in
admin | maintain)
	echo "Skipping audit ([ignore-audit] authorized for ${GITHUB_ACTOR} as ${perm})"
	exit 0
	;;
*)
	echo "Ignoring [ignore-audit]: actor ${GITHUB_ACTOR} permission=${perm:-unknown} (need admin or maintain)" >&2
	exit 1
	;;
esac
