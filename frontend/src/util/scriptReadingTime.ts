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
	estimateScriptReadingSeconds,
	formatReadingClock,
	resolveEffectiveScriptCps as resolveEffectiveScriptCpsBackend
} from '~backend/background/scriptReadingTime'

/** Resolve effective CPS: user account override → site default → built-in default. */
export function resolveEffectiveScriptCps(options: {
	userScriptCps?: number | null
	settingsCps?: number
}): number {
	return resolveEffectiveScriptCpsBackend(options.userScriptCps, options.settingsCps)
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
