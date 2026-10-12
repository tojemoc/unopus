import { CoreConnectionStatus } from './interfaces'
import { coreHandler } from './coreHandler'
import { toSafeCoreOperatorLabel } from './coreOperatorLabels'
import type {
	CorePartSettingsResult,
	CoreRundownPartSettings,
	RundownAutoNextState
} from './autoNextTypes'
export type {
	CorePartSettingsResult,
	CoreRundownPartSettings,
	RundownAutoNextPartState,
	RundownAutoNextSource,
	RundownAutoNextState
} from './autoNextTypes'

interface CoreRundownPartSettingsResponse {
	rundownExternalId: string
	parts: CoreRundownPartSettings[]
}

export const CORE_PART_SETTINGS_METHOD = 'peripheralDevice.ingest.getRundownPartSettings'

const CORE_CACHE_TTL_MS = 5_000
const LAST_INGEST_RETENTION_MS = 60_000
const coreCache = new Map<string, { expiresAt: number; result: CorePartSettingsResult }>()
const coreRequests = new Map<string, Promise<CorePartSettingsResult>>()
const lastPartIngestAt = new Map<string, number>()

async function fetchCorePartSettings(rundownExternalId: string): Promise<CorePartSettingsResult> {
	if (coreHandler.connectionInfo.status !== CoreConnectionStatus.CONNECTED) {
		return { source: 'core-disconnected' }
	}

	try {
		const response = (await coreHandler.core.callMethodRaw(CORE_PART_SETTINGS_METHOD, [
			rundownExternalId
		])) as CoreRundownPartSettingsResponse

		return {
			source: 'core',
			parts: Array.isArray(response?.parts)
				? response.parts.filter(
						(part) =>
							typeof part?.partExternalId === 'string' &&
							typeof part.autoNext === 'boolean' &&
							(part.expectedDuration === null ||
								(typeof part.expectedDuration === 'number' &&
									Number.isFinite(part.expectedDuration)))
					)
				: []
		}
	} catch (error) {
		const rawMessage = error instanceof Error ? error.message : String(error)
		const stack = error instanceof Error ? error.stack : undefined
		console.warn('Core part AUTO settings unavailable:', rawMessage, stack ?? '')
		return {
			source: 'core-error',
			error: toSafeCoreOperatorLabel(error)
		}
	}
}

export async function fetchCorePartSettingsForRundown(
	rundownExternalId: string
): Promise<CorePartSettingsResult> {
	const now = Date.now()
	const cached = coreCache.get(rundownExternalId)
	if (cached && cached.expiresAt > now) {
		return cached.result
	}

	const activeRequest = coreRequests.get(rundownExternalId)
	if (activeRequest) {
		return activeRequest
	}

	const request = fetchCorePartSettings(rundownExternalId)
	coreRequests.set(rundownExternalId, request)
	try {
		const result = await request
		coreCache.set(rundownExternalId, {
			expiresAt: Date.now() + CORE_CACHE_TTL_MS,
			result
		})
		return result
	} finally {
		coreRequests.delete(rundownExternalId)
	}
}

export function recordPartIngestForAutoNext(rundownId: string, partId: string): number {
	const timestamp = Date.now()
	lastPartIngestAt.set(`${rundownId}:${partId}`, timestamp)

	for (const [key, value] of lastPartIngestAt) {
		if (timestamp - value > LAST_INGEST_RETENTION_MS) {
			lastPartIngestAt.delete(key)
		}
	}
	return timestamp
}

export function lastPartIngestForAutoNext(rundownId: string, partId: string): number | undefined {
	return lastPartIngestAt.get(`${rundownId}:${partId}`)
}
