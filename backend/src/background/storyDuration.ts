/**
 * Story (part) ↔ timed graphic piece duration inheritance.
 *
 * Single source of truth for what Rundown Editor displays and exports to Sofie ingest.
 * Keep in sync with megarepo assets piece types that need on-air enable length.
 */
export const STORY_DURATION_INHERIT_PIECE_TYPES = new Set([
	'headline',
	'doublebox-ilu',
	'l3d-headline',
	'l3d-tema',
	'l3d-mod',
	'l3d-predstavovak',
	'l3d-syn',
	'l3d-sjv',
	'l3d-sport',
	'l3d-odporucanie'
])

export function isPositiveDurationSeconds(
	duration: number | undefined | null
): duration is number {
	return typeof duration === 'number' && Number.isFinite(duration) && duration > 0
}

export function pieceInheritsPartDuration(pieceType: string): boolean {
	return STORY_DURATION_INHERIT_PIECE_TYPES.has(pieceType.trim().toLowerCase())
}

export type StoryDurationPiece = {
	id: string
	pieceType: string
	duration?: number
}

export type StoryDurationPart = {
	duration?: number
}

/** Effective on-air duration for one piece (seconds), before persistence. */
export function resolvePieceOnAirDuration(
	piece: Pick<StoryDurationPiece, 'duration' | 'pieceType'>,
	partDuration: number | undefined
): number | undefined {
	if (isPositiveDurationSeconds(piece.duration)) {
		return piece.duration
	}
	if (pieceInheritsPartDuration(piece.pieceType) && isPositiveDurationSeconds(partDuration)) {
		return partDuration
	}
	return undefined
}

/** Effective story on-air duration (seconds). */
export function resolvePartOnAirDuration(
	part: StoryDurationPart,
	pieces: Array<Pick<StoryDurationPiece, 'duration' | 'pieceType'>>
): number | undefined {
	if (isPositiveDurationSeconds(part.duration)) {
		return part.duration
	}

	let maxChild = 0
	for (const piece of pieces) {
		if (isPositiveDurationSeconds(piece.duration)) {
			maxChild = Math.max(maxChild, piece.duration)
		}
	}

	return maxChild > 0 ? maxChild : undefined
}

export type StoryDurationSyncPlan = {
	partDuration?: number
	pieceUpdates: Array<{ id: string; duration: number }>
}

/**
 * Compute DB updates so stored part/piece durations match what we export to Sofie.
 *
 * 1. Part duration → inheriting pieces with no explicit duration
 * 2. When part duration is empty → set from longest explicit child duration, then fill siblings
 */
export function planStoryDurationSync(
	part: StoryDurationPart,
	pieces: StoryDurationPiece[]
): StoryDurationSyncPlan {
	const pieceUpdates: Array<{ id: string; duration: number }> = []
	let partDuration = part.duration

	if (isPositiveDurationSeconds(partDuration)) {
		for (const piece of pieces) {
			if (
				!isPositiveDurationSeconds(piece.duration) &&
				pieceInheritsPartDuration(piece.pieceType)
			) {
				pieceUpdates.push({ id: piece.id, duration: partDuration })
			}
		}
		return { pieceUpdates }
	}

	const maxChild = resolvePartOnAirDuration(part, pieces)
	if (!isPositiveDurationSeconds(maxChild)) {
		return { pieceUpdates }
	}

	partDuration = maxChild

	const effectiveById = new Map<string, number>()
	for (const piece of pieces) {
		if (isPositiveDurationSeconds(piece.duration)) {
			effectiveById.set(piece.id, piece.duration)
		}
	}
	for (const update of pieceUpdates) {
		effectiveById.set(update.id, update.duration)
	}

	for (const piece of pieces) {
		if (effectiveById.has(piece.id)) {
			continue
		}
		if (pieceInheritsPartDuration(piece.pieceType)) {
			pieceUpdates.push({ id: piece.id, duration: partDuration })
			effectiveById.set(piece.id, partDuration)
		}
	}

	return {
		partDuration,
		pieceUpdates
	}
}
