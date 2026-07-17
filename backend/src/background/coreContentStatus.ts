import { CoreConnectionStatus } from './interfaces'
import { coreHandler } from './coreHandler'

const CORE_CONTENT_STATUS_METHOD = 'peripheralDevice.packageManager.getContentStatusForRundown'

/** PieceStatusCode.OK in corelib — readiness uses this when Core reports ready. */
export const CORE_PIECE_STATUS_OK = 0

export interface CorePieceContentStatus {
	pieceExternalId: string
	partExternalId?: string
	statusCode: number
	ready: boolean
	reason?: string
}

export interface CoreRundownContentStatus {
	rundownExternalId: string
	pieces: CorePieceContentStatus[]
}

/**
 * Poll Core for package-manager-derived piece readiness for a synced rundown.
 * Returns null when Core is disconnected or the method is unavailable (caller should fs-fallback).
 */
export async function fetchCoreContentStatusForRundown(
	rundownExternalId: string
): Promise<Map<string, CorePieceContentStatus> | null> {
	if (coreHandler.connectionInfo.status !== CoreConnectionStatus.CONNECTED) {
		return null
	}

	try {
		const response = (await coreHandler.core.callMethodRaw(CORE_CONTENT_STATUS_METHOD, [
			rundownExternalId
		])) as CoreRundownContentStatus

		const map = new Map<string, CorePieceContentStatus>()
		for (const piece of response?.pieces ?? []) {
			map.set(piece.pieceExternalId, piece)
		}
		return map
	} catch (error) {
		console.warn(
			'Core content status unavailable, falling back to local filesystem check:',
			error instanceof Error ? error.message : error
		)
		return null
	}
}
