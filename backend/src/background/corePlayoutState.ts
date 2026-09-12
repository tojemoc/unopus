import { CoreConnectionStatus } from './interfaces'
import { coreHandler } from './coreHandler'
import { toSafeCoreOperatorLabel } from './coreOperatorLabels'

export const CORE_PLAYOUT_STATE_METHOD = 'peripheralDevice.ingest.getRundownPlayoutState'

export interface CoreRundownPlayoutState {
	rundownExternalId: string
	activated: boolean
	rehearsal: boolean
	previousPartExternalId: string | null
	currentPartExternalId: string | null
	nextPartExternalId: string | null
}

export type CorePlayoutStateResult =
	| { source: 'core'; state: CoreRundownPlayoutState }
	| { source: 'core-disconnected' }
	| { source: 'core-error'; error: string }

/**
 * Poll Sofie Core for previous / current / next part external ids for a synced rundown.
 */
export async function fetchCorePlayoutStateForRundown(
	rundownExternalId: string
): Promise<CorePlayoutStateResult> {
	if (coreHandler.connectionInfo.status !== CoreConnectionStatus.CONNECTED) {
		return { source: 'core-disconnected' }
	}

	try {
		const response = (await coreHandler.core.callMethodRaw(CORE_PLAYOUT_STATE_METHOD, [
			rundownExternalId
		])) as CoreRundownPlayoutState

		return {
			source: 'core',
			state: {
				rundownExternalId: response?.rundownExternalId ?? rundownExternalId,
				activated: Boolean(response?.activated),
				rehearsal: Boolean(response?.rehearsal),
				previousPartExternalId: response?.previousPartExternalId ?? null,
				currentPartExternalId: response?.currentPartExternalId ?? null,
				nextPartExternalId: response?.nextPartExternalId ?? null
			}
		}
	} catch (error) {
		const rawMessage = error instanceof Error ? error.message : String(error)
		const stack = error instanceof Error ? error.stack : undefined
		console.warn('Core playout state unavailable:', rawMessage, stack ?? '')
		return {
			source: 'core-error',
			error: toSafeCoreOperatorLabel(error)
		}
	}
}
