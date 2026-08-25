/**
 * Story (part) ↔ timed graphic piece duration inheritance.
 *
 * Single source of truth for what Rundown Editor displays and exports to Sofie ingest.
 * Keep in sync with megarepo assets piece types that need on-air enable length.
 *
 * Duration sources:
 * - ILU / DoubleBox parts → part script reading time (CPS) → ILU pieces
 * - SYN / VO / VT parts → ffprobe length on the video piece
 * - Skipped parts/pieces are excluded from timing
 */
import {
	estimateScriptReadingSeconds,
	partUsesScriptDuration,
	pieceReceivesScriptDuration
} from './scriptReadingTime.js'

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

const MEDIA_VIDEO_PIECE_TYPES = new Set(['video'])

export function isMediaVideoPieceType(pieceType: string): boolean {
	return MEDIA_VIDEO_PIECE_TYPES.has(pieceType.trim().toLowerCase())
}

function positiveNumber(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		return undefined
	}
	return value
}

/**
 * On-air seconds for a SYN/VO/VT clip after trim-in / trim-out.
 * `sourceDuration` is milliseconds (ffprobe); trim fields are seconds.
 */
export function resolveTrimmedSourceDurationSeconds(piece: {
	pieceType: string
	payload?: Record<string, unknown> | null
}): number | undefined {
	if (!isMediaVideoPieceType(piece.pieceType)) {
		return undefined
	}
	const sourceMs = positiveNumber(piece.payload?.sourceDuration)
	if (!sourceMs) {
		return undefined
	}
	const trimIn = positiveNumber(piece.payload?.trimIn) ?? 0
	const trimOut = positiveNumber(piece.payload?.trimOut) ?? 0
	const seconds = sourceMs / 1000 - trimIn - trimOut
	if (!Number.isFinite(seconds) || seconds <= 0) {
		return undefined
	}
	return Math.round(seconds * 10) / 10
}

export type StoryDurationPiece = {
	id: string
	pieceType: string
	duration?: number
	skip?: boolean
	payload?: Record<string, unknown> | null
}

export type StoryDurationPart = {
	duration?: number
	script?: string
	partType?: string
	skip?: boolean
}

export type StoryDurationOptions = {
	/** Characters per second for script → ILU duration. */
	scriptCps?: number
}

function activePieces<T extends { skip?: boolean }>(pieces: T[]): T[] {
	return pieces.filter((piece) => !piece.skip)
}

/** Script-derived duration for ILU-family stories (seconds). */
export function resolveScriptDerivedPartDuration(
	part: StoryDurationPart,
	options?: StoryDurationOptions
): number | undefined {
	if (part.skip) {
		return undefined
	}
	if (!partUsesScriptDuration(part.partType)) {
		return undefined
	}
	return estimateScriptReadingSeconds(part.script, options?.scriptCps)
}

/** Effective on-air duration for one piece (seconds), before persistence. */
export function resolvePieceOnAirDuration(
	piece: Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'skip'>,
	partDuration: number | undefined
): number | undefined {
	if (piece.skip) {
		return undefined
	}
	if (isPositiveDurationSeconds(piece.duration)) {
		return piece.duration
	}
	if (pieceInheritsPartDuration(piece.pieceType) && isPositiveDurationSeconds(partDuration)) {
		return partDuration
	}
	return undefined
}

/**
 * Effective story on-air duration (seconds).
 *
 * Order of preference:
 * 1. Script reading time for ILU-family parts (script is source of truth for ILU)
 * 2. Explicit positive part.duration (manual / media-synced)
 * 3. Longest non-skipped child piece duration (SYN video, etc.)
 */
export function resolvePartOnAirDuration(
	part: StoryDurationPart,
	pieces: Array<Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'skip'>>,
	options?: StoryDurationOptions
): number | undefined {
	if (part.skip) {
		return undefined
	}

	const scriptDuration = resolveScriptDerivedPartDuration(part, options)
	if (isPositiveDurationSeconds(scriptDuration)) {
		return scriptDuration
	}

	if (isPositiveDurationSeconds(part.duration)) {
		return part.duration
	}

	let maxChild = 0
	for (const piece of activePieces(pieces)) {
		if (isPositiveDurationSeconds(piece.duration)) {
			maxChild = Math.max(maxChild, piece.duration)
		}
	}

	return maxChild > 0 ? maxChild : undefined
}

/**
 * Sum of story durations that contribute to rundown timing
 * (ILU script times + SYN/media lengths for non-skipped parts).
 */
export function sumPartsOnAirDuration(
	parts: Array<{
		part: StoryDurationPart
		pieces: Array<Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'skip'>>
	}>,
	options?: StoryDurationOptions
): number {
	let total = 0
	for (const entry of parts) {
		const duration = resolvePartOnAirDuration(entry.part, entry.pieces, options)
		if (isPositiveDurationSeconds(duration)) {
			total += duration
		}
	}
	return total
}

export type StoryDurationSyncPlan = {
	partDuration?: number
	/** When set, overwrite part.duration even if already positive (script is source of truth). */
	forcePartDuration?: boolean
	pieceUpdates: Array<{ id: string; duration: number; force?: boolean }>
}

/**
 * Compute DB updates so stored part/piece durations match what we export to Sofie.
 *
 * 1. ILU-family + script → force part + script-receiving pieces to reading time
 * 2. Part duration → inheriting pieces with no explicit duration
 * 3. When part duration is empty → set from longest explicit child duration, then fill siblings
 * 4. Skipped pieces are never updated / never contribute
 */
export function planStoryDurationSync(
	part: StoryDurationPart,
	pieces: StoryDurationPiece[],
	options?: StoryDurationOptions
): StoryDurationSyncPlan {
	const pieceUpdates: Array<{ id: string; duration: number; force?: boolean }> = []
	const livePieces = activePieces(pieces) as StoryDurationPiece[]

	if (part.skip) {
		return { pieceUpdates }
	}

	const scriptDuration = resolveScriptDerivedPartDuration(part, options)
	if (isPositiveDurationSeconds(scriptDuration)) {
		for (const piece of livePieces) {
			if (pieceReceivesScriptDuration(piece.pieceType)) {
				if (piece.duration !== scriptDuration) {
					pieceUpdates.push({ id: piece.id, duration: scriptDuration, force: true })
				}
			} else if (
				!isPositiveDurationSeconds(piece.duration) &&
				pieceInheritsPartDuration(piece.pieceType)
			) {
				pieceUpdates.push({ id: piece.id, duration: scriptDuration })
			}
		}
		return {
			partDuration: scriptDuration,
			forcePartDuration: part.duration !== scriptDuration,
			pieceUpdates
		}
	}

	let partDuration = part.duration

	for (const piece of livePieces) {
		const trimmed = resolveTrimmedSourceDurationSeconds(piece)
		if (!trimmed) {
			continue
		}
		if (piece.duration !== trimmed) {
			pieceUpdates.push({ id: piece.id, duration: trimmed, force: true })
			piece.duration = trimmed
		}
	}

	if (isPositiveDurationSeconds(partDuration)) {
		for (const piece of livePieces) {
			if (
				!isPositiveDurationSeconds(piece.duration) &&
				pieceInheritsPartDuration(piece.pieceType)
			) {
				pieceUpdates.push({ id: piece.id, duration: partDuration })
			}
		}
		return { pieceUpdates }
	}

	const maxChild = resolvePartOnAirDuration(part, livePieces, options)
	if (!isPositiveDurationSeconds(maxChild)) {
		return { pieceUpdates }
	}

	partDuration = maxChild

	const effectiveById = new Map<string, number>()
	for (const piece of livePieces) {
		if (isPositiveDurationSeconds(piece.duration)) {
			effectiveById.set(piece.id, piece.duration)
		}
	}
	for (const update of pieceUpdates) {
		effectiveById.set(update.id, update.duration)
	}

	for (const piece of livePieces) {
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
