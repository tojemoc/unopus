import { CoreConnectionStatus } from './interfaces'
import { coreHandler } from './coreHandler'
import { toSafeCoreOperatorLabel } from './coreOperatorLabels'

export const CORE_CONTENT_STATUS_METHOD = 'peripheralDevice.packageManager.getContentStatusForRundown'

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
 * Discriminated result from polling Core for package-manager-derived piece readiness.
 *
 * `source: 'core'` with an empty `statuses` map only means Core answered with zero piece
 * statuses — that can be "rundown not synced yet" *or* "synced but every piece lacked a
 * resolvable sourceLayer". The current Core API cannot tell those apart; do not label empty
 * as "not synced" in UI copy.
 */
export type CoreContentStatusResult =
	| { source: 'core'; statuses: Map<string, CorePieceContentStatus> }
	| { source: 'core-disconnected' }
	| { source: 'core-error'; error: string }

/**
 * Poll Core for package-manager-derived piece readiness for a synced rundown.
 * Preserves the failure reason so callers can surface diagnostics instead of silently
 * collapsing every failure into a filesystem fallback.
 */
export async function fetchCoreContentStatusForRundown(
	rundownExternalId: string
): Promise<CoreContentStatusResult> {
	if (coreHandler.connectionInfo.status !== CoreConnectionStatus.CONNECTED) {
		return { source: 'core-disconnected' }
	}

	try {
		const response = (await coreHandler.core.callMethodRaw(CORE_CONTENT_STATUS_METHOD, [
			rundownExternalId
		])) as CoreRundownContentStatus

		const map = new Map<string, CorePieceContentStatus>()
		for (const piece of response?.pieces ?? []) {
			map.set(piece.pieceExternalId, piece)
		}
		return { source: 'core', statuses: map }
	} catch (error) {
		const rawMessage = error instanceof Error ? error.message : String(error)
		const stack = error instanceof Error ? error.stack : undefined
		console.warn(
			'Core content status unavailable, falling back to local filesystem check:',
			rawMessage,
			stack ?? ''
		)
		return {
			source: 'core-error',
			error: toSafeCoreOperatorLabel(error)
		}
	}
}
