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
	pieceInheritsPartDuration,
	type StoryDurationOptions
} from '~backend/background/storyDuration'
import { formatSecondsClock } from './pieceDurationFormat.js'

export { resolvePieceOnAirDuration, resolvePartOnAirDuration, pieceInheritsPartDuration }

export const DEFAULT_WIPE_DURATION_SECONDS = 2.5

export {
	WIPE_CUT_POINT_SECONDS,
	formatSecondsPrecise,
	formatSecondsClock,
	parseDurationClockInput,
	findNearDuplicateMediaNames
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
