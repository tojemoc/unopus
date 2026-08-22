/**
 * Estimate spoken reading duration from script text.
 * CPS = characters per second (spaces count; ignore lone newlines).
 */

export const DEFAULT_SCRIPT_CPS = 15

/** Part types whose on-air length is driven by the part script (ILU family). */
export const SCRIPT_DURATION_PART_TYPES = new Set(['ilu', 'doublebox'])

/** Piece types that receive the story script reading time as on-air duration. */
export const SCRIPT_DURATION_PIECE_TYPES = new Set(['headline', 'doublebox-ilu'])

/** Part types whose on-air length is driven by the linked video clip (ffprobe). */
export const MEDIA_DURATION_PART_TYPES = new Set(['syn', 'vo', 'vt'])

export function normalizeScriptCps(cps: number | undefined | null): number {
	if (typeof cps !== 'number' || !Number.isFinite(cps) || cps <= 0) {
		return DEFAULT_SCRIPT_CPS
	}
	// Clamp to a practical speaking range.
	return Math.min(40, Math.max(5, cps))
}

/** Count characters that contribute to speaking time. */
export function countScriptCharacters(text: string | undefined | null): number {
	if (!text) {
		return 0
	}
	// Collapse whitespace runs so blank lines / padding do not inflate duration.
	const normalized = text.replace(/\s+/g, ' ').trim()
	return normalized.length
}

/** Reading duration in whole seconds (ceil). Empty script → undefined. */
export function estimateScriptReadingSeconds(
	text: string | undefined | null,
	cps: number | undefined | null = DEFAULT_SCRIPT_CPS
): number | undefined {
	const chars = countScriptCharacters(text)
	if (chars <= 0) {
		return undefined
	}
	const rate = normalizeScriptCps(cps)
	return Math.max(1, Math.ceil(chars / rate))
}

/** Format seconds as mm:ss (or h:mm:ss when needed). */
export function formatReadingClock(seconds: number | undefined): string {
	if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
		return '00:00'
	}
	const total = Math.floor(seconds)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const pad = (n: number) => String(n).padStart(2, '0')
	if (h > 0) {
		return `${pad(h)}:${pad(m)}:${pad(s)}`
	}
	return `${pad(m)}:${pad(s)}`
}

export function partUsesScriptDuration(partType: string | undefined | null): boolean {
	return SCRIPT_DURATION_PART_TYPES.has((partType ?? '').trim().toLowerCase())
}

export function pieceReceivesScriptDuration(pieceType: string | undefined | null): boolean {
	return SCRIPT_DURATION_PIECE_TYPES.has((pieceType ?? '').trim().toLowerCase())
}

export function partUsesMediaDuration(partType: string | undefined | null): boolean {
	return MEDIA_DURATION_PART_TYPES.has((partType ?? '').trim().toLowerCase())
}

/** Per-user CPS when set; otherwise application default (or built-in default). */
export function resolveEffectiveScriptCps(
	userScriptCps: number | null | undefined,
	settingsCps: number | undefined
): number {
	if (typeof userScriptCps === 'number' && Number.isFinite(userScriptCps) && userScriptCps > 0) {
		return normalizeScriptCps(userScriptCps)
	}
	return normalizeScriptCps(settingsCps ?? DEFAULT_SCRIPT_CPS)
}
