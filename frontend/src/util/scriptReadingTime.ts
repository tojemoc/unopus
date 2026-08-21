/**
 * Frontend re-exports + helpers for script reading-time counters.
 */
export {
	DEFAULT_SCRIPT_CPS,
	SCRIPT_DURATION_PART_TYPES,
	SCRIPT_DURATION_PIECE_TYPES,
	MEDIA_DURATION_PART_TYPES,
	normalizeScriptCps,
	countScriptCharacters,
	estimateScriptReadingSeconds,
	formatReadingClock,
	partUsesScriptDuration,
	pieceReceivesScriptDuration,
	partUsesMediaDuration
} from '~backend/background/scriptReadingTime'

import {
	DEFAULT_SCRIPT_CPS,
	estimateScriptReadingSeconds,
	formatReadingClock,
	normalizeScriptCps
} from '~backend/background/scriptReadingTime'

const USER_CPS_STORAGE_PREFIX = 'unopus-script-cps:'

export function readUserScriptCps(userId: string | undefined): number | undefined {
	if (!userId || typeof localStorage === 'undefined') {
		return undefined
	}
	try {
		const raw = localStorage.getItem(`${USER_CPS_STORAGE_PREFIX}${userId}`)
		if (raw === null || raw === '') {
			return undefined
		}
		const parsed = Number(raw)
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return undefined
		}
		return normalizeScriptCps(parsed)
	} catch {
		return undefined
	}
}

export function writeUserScriptCps(userId: string | undefined, cps: number): void {
	if (!userId || typeof localStorage === 'undefined') {
		return
	}
	try {
		localStorage.setItem(`${USER_CPS_STORAGE_PREFIX}${userId}`, String(normalizeScriptCps(cps)))
	} catch {
		// ignore quota / private mode
	}
}

export function clearUserScriptCps(userId: string | undefined): void {
	if (!userId || typeof localStorage === 'undefined') {
		return
	}
	try {
		localStorage.removeItem(`${USER_CPS_STORAGE_PREFIX}${userId}`)
	} catch {
		// ignore
	}
}

/** Resolve effective CPS: per-user override → settings default → built-in default. */
export function resolveEffectiveScriptCps(options: {
	userId?: string
	settingsCps?: number
}): number {
	const userCps = readUserScriptCps(options.userId)
	if (userCps !== undefined) {
		return userCps
	}
	return normalizeScriptCps(options.settingsCps ?? DEFAULT_SCRIPT_CPS)
}

export function formatScriptReadingEstimate(
	text: string | undefined | null,
	cps: number
): { seconds: number | undefined; clock: string; chars: number } {
	const seconds = estimateScriptReadingSeconds(text, cps)
	return {
		seconds,
		clock: formatReadingClock(seconds ?? 0),
		chars: text ? text.replace(/\s+/g, ' ').trim().length : 0
	}
}
