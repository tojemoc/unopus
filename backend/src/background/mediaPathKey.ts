/**
 * Canonical media path match key for joining filesystem listings to Core
 * piece-content statuses. Shared by listing enrichment and unit tests.
 *
 * Reject first (return null — do not strip/collapse on these):
 *   - UNC paths (`//…` or `\\…`)
 *   - device/protocol URLs (`dshow://…`, `http(s)://…`, etc.)
 *
 * Then for remaining paths: `\`→`/`, collapse duplicate `/`, drop trailing `/`,
 * lower-case. Absolute paths (drive-letter or POSIX) under the ingest root are
 * stripped to a relative key; paths outside the root stay unmatched.
 */
export function normalizeMediaMatchKey(
	rawPath: string,
	ingestRoot?: string
): string | null {
	const trimmed = rawPath.trim()
	if (!trimmed) {
		return null
	}

	// Reject UNC before any backslash collapsing (would corrupt `\\server\share`).
	if (trimmed.startsWith('\\\\') || trimmed.startsWith('//')) {
		return null
	}

	// Reject protocol / device URLs.
	if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^[a-z]:[/\\]/i.test(trimmed)) {
		return null
	}

	let normalized = trimmed.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '').toLowerCase()

	if (!normalized) {
		return null
	}

	const isDriveAbsolute = /^[a-z]:\//i.test(normalized)
	const isPosixAbsolute = normalized.startsWith('/')

	if (ingestRoot) {
		let root = ingestRoot
			.trim()
			.replace(/\\/g, '/')
			.replace(/\/+/g, '/')
			.replace(/\/+$/, '')
			.toLowerCase()

		if (/^[a-z]:$/i.test(root)) {
			root = `${root}/`
		}

		const rootWithoutTrailing = root.replace(/\/$/, '')
		const rootPrefix = root.endsWith('/') ? root : `${root}/`

		if (isDriveAbsolute || isPosixAbsolute) {
			if (normalized === rootWithoutTrailing) {
				return null
			}
			if (normalized.startsWith(rootPrefix)) {
				normalized = normalized.slice(rootPrefix.length)
				if (!normalized) {
					return null
				}
			} else {
				// Absolute path outside ingest root — unmatched.
				return null
			}
		}
		// Relative paths: leave for leading-slash strip at end.
	} else if (isDriveAbsolute) {
		// No ingest root provided — cannot strip drive letter safely.
		return null
	}

	if (normalized.startsWith('/')) {
		normalized = normalized.replace(/^\/+/, '')
	}

	return normalized || null
}

export type CoreVerdictForJoin = {
	pieceExternalId: string
	fieldId: string
	matchKey: string
	ready: boolean
	reason?: string
}

export type AggregatedMediaReadiness = {
	readiness: 'confirmed' | 'not-confirmed' | 'unknown'
	reason?: string
}

/**
 * Aggregate Core verdicts for one match key.
 * Any ready===false → not-confirmed; else all ready → confirmed.
 * Empty verdicts → unknown. Reasons from not-ready verdicts are ordered by
 * pieceExternalId then fieldId.
 */
export function aggregateCoreVerdictsForKey(
	verdicts: CoreVerdictForJoin[]
): AggregatedMediaReadiness {
	if (!verdicts.length) {
		return { readiness: 'unknown', reason: 'not yet confirmed by Package Manager' }
	}

	const notReady = verdicts.filter((verdict) => !verdict.ready)
	if (notReady.length > 0) {
		const sorted = [...notReady].sort((a, b) => {
			const pieceCmp = a.pieceExternalId.localeCompare(b.pieceExternalId)
			if (pieceCmp !== 0) return pieceCmp
			return a.fieldId.localeCompare(b.fieldId)
		})
		const reasons = sorted
			.map((verdict) => verdict.reason?.trim())
			.filter((reason): reason is string => Boolean(reason))
		const unique: string[] = []
		for (const reason of reasons) {
			if (!unique.includes(reason)) unique.push(reason)
		}
		return {
			readiness: 'not-confirmed',
			reason: unique.length ? unique.join('; ') : undefined
		}
	}

	return { readiness: 'confirmed' }
}
