import type { CoreRundownPartSettings, RundownAutoNextSource } from './autoNextState'

export const AUTO_NEXT_PENDING_GRACE_MS = 15_000
export type AutoNextStatus = 'confirmed' | 'pending' | 'mismatch' | 'no-duration' | 'unknown'

export function getAutoNextStatus(input: {
	source: RundownAutoNextSource
	intentOn: boolean
	part?: CoreRundownPartSettings
	lastIngestAt?: number
	now?: number
}): AutoNextStatus {
	if (input.source !== 'core') {
		return 'unknown'
	}

	const now = input.now ?? Date.now()
	const isRecentIngest =
		input.lastIngestAt !== undefined &&
		now - input.lastIngestAt >= 0 &&
		now - input.lastIngestAt < AUTO_NEXT_PENDING_GRACE_MS
	if (!input.part) {
		return isRecentIngest ? 'pending' : 'unknown'
	}

	if (input.intentOn && input.part.expectedDuration === null) {
		return 'no-duration'
	}

	const effective = input.part.autoNext && input.part.expectedDuration !== null
	if (input.intentOn === effective) {
		return 'confirmed'
	}

	if (isRecentIngest) {
		return 'pending'
	}
	return 'mismatch'
}
