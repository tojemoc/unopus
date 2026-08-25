import type { Piece } from '~backend/background/interfaces'
import { estimateScriptReadingSeconds, formatReadingClock } from './scriptReadingTime'

/** Character index in the part script where a piece cue sits. */
export function resolvePieceScriptOffset(piece: Piece, scriptLength: number): number {
	const raw = piece.payload?.scriptOffset
	const fromPayload = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : undefined
	if (fromPayload !== undefined) {
		return Math.min(fromPayload, scriptLength)
	}
	// Legacy: map start seconds → char index using a neutral CPS so ordering still works.
	if (typeof piece.start === 'number' && Number.isFinite(piece.start) && piece.start > 0) {
		return Math.min(Math.round(piece.start * 15), scriptLength)
	}
	return 0
}

export function formatPieceCueOffset(
	script: string | undefined,
	piece: Piece,
	cps: number
): string {
	const text = script ?? ''
	const offset = resolvePieceScriptOffset(piece, text.length)
	const preceding = text.slice(0, offset)
	const seconds = estimateScriptReadingSeconds(preceding, cps) ?? 0
	return `+${formatReadingClock(seconds)}`
}

export function sortPiecesByScriptOffset(pieces: Piece[], scriptLength: number): Piece[] {
	return [...pieces].sort((a, b) => {
		const ao = resolvePieceScriptOffset(a, scriptLength)
		const bo = resolvePieceScriptOffset(b, scriptLength)
		if (ao !== bo) return ao - bo
		return (a.rank ?? 0) - (b.rank ?? 0)
	})
}
