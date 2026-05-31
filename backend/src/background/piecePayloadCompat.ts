import type { Piece, PayloadValue } from './interfaces'

function isHeadPiece(pieceType: string): boolean {
	return pieceType.trim().toLowerCase() === 'head'
}

/** Read-time compat: legacy head pieces used payload.text instead of title. */
export function normalizeHeadPiecePayload(piece: Piece): Piece {
	if (!isHeadPiece(piece.pieceType)) return piece

	const payload = { ...(piece.payload ?? {}) } as Record<string, PayloadValue>
	const legacyText = payload.text
	const hasTitle =
		typeof payload.title === 'string' && payload.title.trim().length > 0

	if (!hasTitle && typeof legacyText === 'string' && legacyText.trim()) {
		payload.title = legacyText.trim()
	}

	return { ...piece, payload }
}

/** Write-time compat: persist title and drop obsolete text on head pieces. */
export function prepareHeadPiecePayloadForSave(
	pieceType: string,
	payload: Record<string, PayloadValue> | undefined
): Record<string, PayloadValue> {
	if (!isHeadPiece(pieceType)) return payload ?? {}

	const next = { ...(payload ?? {}) }
	if (typeof next.text === 'string') {
		const legacyText = next.text.trim()
		if (legacyText && !(typeof next.title === 'string' && next.title.trim())) {
			next.title = legacyText
		}
		delete next.text
	}
	return next
}
