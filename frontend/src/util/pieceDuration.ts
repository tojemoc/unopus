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
	resolvePartOnAirDuration
} from '~backend/background/storyDuration'

export { resolvePieceOnAirDuration, resolvePartOnAirDuration }

export const DEFAULT_WIPE_DURATION_SECONDS = 2.5

export {
	WIPE_CUT_POINT_SECONDS,
	formatSecondsPrecise
} from './pieceDurationFormat.js'

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

export function formatPieceOnAirDuration(
	piece: {
		pieceType: string
		duration?: number
	},
	partDuration?: number
): string {
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

export function formatPartOnAirDuration(
	part: { duration?: number },
	pieces: Array<{ pieceType: string; duration?: number }>
): string {
	const effective = resolvePartOnAirDuration(part, pieces)
	return effective ? formatSecondsClock(effective) : ''
}

export function formatSourceDurationSeconds(seconds: number | undefined): string {
	if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
		return ''
	}
	return formatSecondsClock(seconds)
}

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
