/**
 * Display helpers for piece on-air vs source (ffprobe) duration.
 *
 * Blueprints `DEFAULT_WIPE_DURATION_MS` = 2500 — full stinger overlay on PGM.
 * The cut point (content switch under the wipe) is at 760ms / 38 frames @ 50fps.
 * During the full wipe window, other audio sources are force-muted so the wipe SFX
 * plays in isolation.
 */
import {
	resolvePieceOnAirDuration,
	resolvePartOnAirDuration,
	type StoryDurationOptions
} from '~backend/background/storyDuration'

export { resolvePieceOnAirDuration, resolvePartOnAirDuration }

export const DEFAULT_WIPE_DURATION_SECONDS = 2.5

export {
	WIPE_CUT_POINT_SECONDS,
	formatSecondsPrecise
} from './pieceDurationFormat.js'

/**
 * Extract piece source duration from payload (milliseconds → seconds).
 */
export function getPieceSourceDurationSeconds(piece: {
	payload?: Record<string, unknown> | null
}): number | undefined {
	const raw = piece.payload?.sourceDuration
	if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
		return undefined
	}
	// Sofie sourceDuration is milliseconds.
	return raw / 1000
}

/**
 * Format piece effective on-air duration as a clock string.
 */
export function formatPieceOnAirDuration(
	piece: {
		pieceType: string
		duration?: number
		skip?: boolean
	},
	partDuration?: number
): string {
	if (piece.skip) {
		return ''
	}
	const effective = resolvePieceOnAirDuration(piece, partDuration)
	if (typeof effective === 'number' && Number.isFinite(effective) && effective > 0) {
		return formatSecondsClock(effective)
	}

	if (piece.pieceType === 'wipe') {
		// Mirrors sofie-demo-blueprints DEFAULT_WIPE_DURATION_MS = 2500
		return formatSecondsClock(DEFAULT_WIPE_DURATION_SECONDS)
	}

	return ''
}

/**
 * Format part effective on-air duration as a clock string.
 */
export function formatPartOnAirDuration(
	part: { duration?: number; script?: string; partType?: string; skip?: boolean },
	pieces: Array<{ pieceType: string; duration?: number; skip?: boolean }>,
	options?: StoryDurationOptions
): string {
	const effective = resolvePartOnAirDuration(part, pieces, options)
	return effective ? formatSecondsClock(effective) : ''
}

/**
 * Format source duration (in seconds) as a clock string.
 */
export function formatSourceDurationSeconds(seconds: number | undefined): string {
	if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
		return ''
	}
	return formatSecondsClock(seconds)
}

/**
 * Format seconds as clock display (mm:ss or h:mm:ss, or Xs for fractional seconds).
 */
export function formatSecondsClock(seconds: number): string {
	// Keep fractional wipe default readable (2.5s) without breaking mm:ss for whole seconds.
	if (!Number.isInteger(seconds) && seconds < 60) {
		const rounded = Math.round(seconds * 10) /  10
		return `${rounded}s`
	}

	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = Math.floor(seconds % 60)
	const pad = (t: number) => ('00' + t).substr(-2)

	return `${h > 0 ? pad(h) + ':' : ''}${pad(m)}:${pad(s)}`
}
