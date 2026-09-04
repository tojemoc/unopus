#!/usr/bin/env bash
# Exit 0 when Dependencies Check may skip yarn audit / license-validate.
# Requires [ignore-audit] in the full tip commit message (subject + body) AND
# the GitHub actor to have admin or maintain permission on this repository.
# Unauthorized markers are ignored so normal validation still runs.
set -euo pipefail

if ! git log -1 --format=%B | grep -Fq '[ignore-audit]'; then
	exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" || -z "${GITHUB_REPOSITORY:-}" || -z "${GITHUB_ACTOR:-}" ]]; then
	echo "Ignoring [ignore-audit]: missing GitHub auth context; running validation" >&2
	exit 1
fi

perm=""
if ! perm="$(
	curl -fsSL \
		-H "Authorization: Bearer ${GITHUB_TOKEN}" \
		-H "Accept: application/vnd.github+json" \
		-H "X-GitHub-Api-Version: 2022-11-28" \
		"https://api.github.com/repos/${GITHUB_REPOSITORY}/collaborators/${GITHUB_ACTOR}/permission" |
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
