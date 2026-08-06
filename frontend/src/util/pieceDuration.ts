/**
 * Display helpers for piece on-air vs source (ffprobe) duration.
 *
 * Blueprints `DEFAULT_WIPE_DURATION_MS` = 2500 — used when wipe on-air duration is empty/0
 * so the UI does not look uncontrolled.
 */
export const DEFAULT_WIPE_DURATION_SECONDS = 2.5

export function getPieceSourceDurationSeconds(piece: {
	payload?: Record<string, unknown> | null
}): number | undefined {
	const raw = piece.payload?.sourceDuration
	if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
		return undefined
	}
	// Softie sourceDuration is milliseconds.
	return raw / 1000
}

export function formatPieceOnAirDuration(piece: {
	pieceType: string
	duration?: number
}): string {
	if (typeof piece.duration === 'number' && Number.isFinite(piece.duration) && piece.duration > 0) {
		return formatSecondsClock(piece.duration)
	}

	if (piece.pieceType === 'wipe') {
		// Mirrors sofie-demo-blueprints DEFAULT_WIPE_DURATION_MS = 2500
		return formatSecondsClock(DEFAULT_WIPE_DURATION_SECONDS)
	}

	return ''
}

export function formatSourceDurationSeconds(seconds: number | undefined): string {
	if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
		return ''
	}
	return formatSecondsClock(seconds)
}

function formatSecondsClock(seconds: number): string {
	// Keep fractional wipe default readable (2.5s) without breaking mm:ss for whole seconds.
	if (!Number.isInteger(seconds) && seconds < 60) {
		const rounded = Math.round(seconds * 10) / 10
		return `${rounded}s`
	}

	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = Math.floor(seconds % 60)
	const pad = (t: number) => ('00' + t).substr(-2)

	return `${h > 0 ? pad(h) + ':' : ''}${pad(m)}:${pad(s)}`
}
