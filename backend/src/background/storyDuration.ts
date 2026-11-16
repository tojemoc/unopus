/**
 * Story (part) ↔ timed graphic piece duration rules.
 *
 * Single source of truth for what Rundown Editor displays and exports to Sofie ingest.
 *
 * Duration sources:
 * - ILU / DoubleBox / SJV / ŠPORT / marker-qualified SYN parts → part script reading
 *   time (CPS). ILU / DoubleBox are manual-only; SJV / ŠPORT may `autoNext`.
 * - Plain SYN in `auto` mode → linked media file length (minus trims); Sofie may `autoNext`.
 * - Same media parts in `manual` (until next take) → explicit On air sticks; no autoNext
 * - VO / VT: media picker seeds On air + sourceDuration from ffprobe; editorial On air
 *   is never force-overwritten by source length (operators may trim timing or clear it)
 * - L3D / inheriting graphics: empty On air is intentional → Sofie enable without duration
 *   (hold until Take). Do not auto-fill from part duration on save.
 * - Skipped parts/pieces are excluded from timing
 */
import type { IluDurationMode } from './interfaces.js'
import {
	estimateScriptReadingSeconds,
	partSupportsAutoNext,
	partUsesMediaDuration,
	partUsesScriptDuration,
	pieceReceivesScriptDuration
} from './scriptReadingTime.js'

export const STORY_DURATION_INHERIT_PIECE_TYPES = new Set([
	'headline',
	'doublebox-ilu',
	'l3d-headline',
	'l3d-tema',
	'l3d-mod',
	'l3d-syn',
	'l3d-sjv',
	'l3d-sport',
	'l3d-odporucanie'
])

/**
 * Type guard: check if a duration value is a positive finite number.
 */
export function isPositiveDurationSeconds(
	duration: number | undefined | null
): duration is number {
	return typeof duration === 'number' && Number.isFinite(duration) && duration > 0
}

/**
 * Piece types that historically inherited part On air in the Dur column.
 * Empty On air on these types means hold until Take (not auto-filled from part).
 */
export function pieceInheritsPartDuration(pieceType: string): boolean {
	return STORY_DURATION_INHERIT_PIECE_TYPES.has(pieceType.trim().toLowerCase())
}

const MEDIA_VIDEO_PIECE_TYPES = new Set(['video'])

/**
 * Check if a piece type is a media video piece (eligible for ffprobe duration).
 */
export function isMediaVideoPieceType(pieceType: string): boolean {
	return MEDIA_VIDEO_PIECE_TYPES.has(pieceType.trim().toLowerCase())
}

/**
 * Extract a positive number from an unknown value, or return undefined.
 */
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
	return roundedPositiveSeconds(sourceMs / 1000 - trimIn - trimOut)
}

function roundedPositiveSeconds(seconds: number): number | undefined {
	if (!Number.isFinite(seconds) || seconds <= 0) {
		return undefined
	}
	const rounded = Math.round(seconds * 10) / 10
	return rounded > 0 ? rounded : undefined
}

function resolveTrimmedEditorialDurationSeconds(
	piece: Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'payload'>
): number | undefined {
	if (!isMediaVideoPieceType(piece.pieceType) || !isPositiveDurationSeconds(piece.duration)) {
		return undefined
	}
	const trimIn = positiveNumber(piece.payload?.trimIn) ?? 0
	const trimOut = positiveNumber(piece.payload?.trimOut) ?? 0
	return roundedPositiveSeconds(piece.duration - trimIn - trimOut)
}

function hasSourceDurationMetadata(
	piece: Pick<StoryDurationPiece, 'pieceType' | 'payload'>
): boolean {
	return (
		isMediaVideoPieceType(piece.pieceType) &&
		positiveNumber(piece.payload?.sourceDuration) !== undefined
	)
}

export type StoryDurationPiece = {
	id: string
	pieceType: string
	duration?: number | null
	skip?: boolean
	payload?: Record<string, unknown> | null
}

export type StoryDurationPart = {
	duration?: number | null
	script?: string
	partType?: string
	skip?: boolean
	/** Per-part override; when unset, use options.defaultDurationMode. */
	durationMode?: IluDurationMode | null
}

export type StoryDurationOptions = {
	/** Characters per second for script-derived durations. */
	scriptCps?: number
	/** Site default when part.durationMode is unset (ApplicationSettings.iluDurationMode). */
	defaultDurationMode?: IluDurationMode
}

/**
 * Effective AUTO-capable take mode: part override → site default → auto.
 */
export function resolveEffectiveIluDurationMode(
	partMode: IluDurationMode | undefined | null,
	siteDefault?: IluDurationMode | null
): IluDurationMode {
	if (partMode === 'auto' || partMode === 'manual') {
		return partMode
	}
	if (siteDefault === 'auto' || siteDefault === 'manual') {
		return siteDefault
	}
	return 'auto'
}

/**
 * Filter out skipped pieces, returning only active ones.
 */
function activePieces<T extends { skip?: boolean }>(pieces: T[]): T[] {
	return pieces.filter((piece) => !piece.skip)
}

/** Script-derived duration for ILU-family / SJV / ŠPORT stories (seconds). */
export function resolveScriptDerivedPartDuration(
	part: StoryDurationPart,
	options?: StoryDurationOptions,
	pieces?: Array<Pick<StoryDurationPiece, 'pieceType' | 'skip'>>
): number | undefined {
	if (part.skip) {
		return undefined
	}
	const pieceTypes = (pieces ?? [])
		.filter((piece) => !piece.skip)
		.map((piece) => piece.pieceType)
	if (!partUsesScriptDuration(part.partType, pieceTypes)) {
		return undefined
	}
	return estimateScriptReadingSeconds(part.script, options?.scriptCps)
}

/**
 * Effective on-air duration for one piece (seconds).
 *
 * Empty duration is intentional: L3Ds hold until Take; video pieces fall back to
 * `sourceDuration` (minus trims) at playout in blueprints. Part duration is not
 * substituted here — that used to make cleared L3Ds reappear with a short enable.
 */
export function resolvePieceOnAirDuration(
	piece: Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'skip'>,
	_partDuration?: number | null | undefined
): number | undefined {
	if (piece.skip) {
		return undefined
	}
	if (isPositiveDurationSeconds(piece.duration)) {
		return piece.duration
	}
	return undefined
}

/**
 * Longest trimmed source duration (seconds) for SYN AUTO. Source metadata wins;
 * trimmed piece On air is the fallback when ffprobe data is missing.
 */
function resolveMediaSourcePartDuration(
	pieces: Array<Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'skip' | 'payload'>>
): number | undefined {
	let maxMedia = 0
	for (const piece of activePieces(pieces)) {
		if (!isMediaVideoPieceType(piece.pieceType)) {
			continue
		}
		const mediaDuration = hasSourceDurationMetadata(piece)
			? resolveTrimmedSourceDurationSeconds(piece)
			: resolveTrimmedEditorialDurationSeconds(piece)
		if (mediaDuration) {
			maxMedia = Math.max(maxMedia, mediaDuration)
		}
	}
	return maxMedia > 0 ? maxMedia : undefined
}

/**
 * Longest blueprint-playable media duration (seconds): trimmed source, falling
 * back to trimmed editorial On air when ffprobe data is missing — matching
 * resolveClipPlayback.
 */
function resolvePlayableMediaPartDuration(
	pieces: Array<Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'skip' | 'payload'>>
): number | undefined {
	let maxMedia = 0
	for (const piece of activePieces(pieces)) {
		if (!isMediaVideoPieceType(piece.pieceType)) {
			continue
		}
		const mediaDuration = hasSourceDurationMetadata(piece)
			? resolveTrimmedSourceDurationSeconds(piece)
			: resolveTrimmedEditorialDurationSeconds(piece)
		if (mediaDuration) {
			maxMedia = Math.max(maxMedia, mediaDuration)
		}
	}
	return maxMedia > 0 ? maxMedia : undefined
}

/**
 * Effective story on-air duration (seconds).
 *
 * 1. Script reading time for ILU / DoubleBox / SJV / ŠPORT / marker-qualified SYN
 * 2. Linked media length for AUTO-capable plain SYN
 * 3. Explicit positive part.duration
 * 4. Longest non-skipped child piece duration
 */
export function resolvePartOnAirDuration(
	part: StoryDurationPart,
	pieces: Array<Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'skip' | 'payload'>>,
	options?: StoryDurationOptions
): number | undefined {
	if (part.skip) {
		return undefined
	}

	const scriptDuration = resolveScriptDerivedPartDuration(part, options, pieces)
	const mode = resolveEffectiveIluDurationMode(part.durationMode, options?.defaultDurationMode)
	const pieceTypes = activePieces(pieces).map((piece) => piece.pieceType)
	const usesMediaDuration = partUsesMediaDuration(part.partType, pieceTypes)
	const mediaSourceDuration = resolveMediaSourcePartDuration(pieces)
	const playableMediaDuration = resolvePlayableMediaPartDuration(pieces)
	const hasMediaSourceMetadata = activePieces(pieces).some(hasSourceDurationMetadata)

	if (isPositiveDurationSeconds(scriptDuration)) {
		return scriptDuration
	}
	if (mode === 'auto' && partSupportsAutoNext(part.partType) && usesMediaDuration) {
		if (mediaSourceDuration) {
			return mediaSourceDuration
		}
		if (hasMediaSourceMetadata) {
			return undefined
		}
	}
	if (isPositiveDurationSeconds(part.duration)) {
		return part.duration
	}
	if (usesMediaDuration && playableMediaDuration) {
		return playableMediaDuration
	}

	let maxChild = 0
	for (const piece of activePieces(pieces)) {
		if (usesMediaDuration && hasSourceDurationMetadata(piece)) {
			continue
		}
		if (isPositiveDurationSeconds(piece.duration)) {
			maxChild = Math.max(maxChild, piece.duration)
			continue
		}
		const trimmed = resolveTrimmedSourceDurationSeconds(piece)
		if (trimmed) {
			maxChild = Math.max(maxChild, trimmed)
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
		pieces: Array<Pick<StoryDurationPiece, 'duration' | 'pieceType' | 'skip' | 'payload'>>
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
 * 1. Script-driven parts + script → force part + script-receiving pieces to reading time
 * 2. AUTO-capable media parts → force part On air to linked media length
 * 3. Never overwrite editorial piece On air from ffprobe source length
 * 4. Never auto-fill L3D / inheriting graphics from part (empty = hold until Take)
 * 5. When part duration is empty → set from playable media, else longest child On air
 * 6. Skipped pieces are never updated / never contribute
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

	const scriptDuration = resolveScriptDerivedPartDuration(part, options, pieces)
	if (isPositiveDurationSeconds(scriptDuration)) {
		for (const piece of livePieces) {
			if (pieceReceivesScriptDuration(piece.pieceType) && piece.duration !== scriptDuration) {
				pieceUpdates.push({ id: piece.id, duration: scriptDuration, force: true })
			}
		}

		return {
			partDuration: scriptDuration,
			forcePartDuration: part.duration !== scriptDuration,
			pieceUpdates
		}
	}

	const mode = resolveEffectiveIluDurationMode(part.durationMode, options?.defaultDurationMode)
	const pieceTypes = livePieces.map((piece) => piece.pieceType)
	const usesMediaDuration = partUsesMediaDuration(part.partType, pieceTypes)
	const mediaSourceDuration = resolveMediaSourcePartDuration(pieces)
	const playableMediaDuration = resolvePlayableMediaPartDuration(pieces)
	const hasMediaSourceMetadata = livePieces.some(hasSourceDurationMetadata)
	if (mode === 'auto' && partSupportsAutoNext(part.partType) && usesMediaDuration) {
		if (mediaSourceDuration) {
			return {
				partDuration: mediaSourceDuration,
				forcePartDuration: part.duration !== mediaSourceDuration,
				pieceUpdates
			}
		}
		if (hasMediaSourceMetadata) {
			return {
				partDuration: 0,
				forcePartDuration: part.duration !== 0,
				pieceUpdates
			}
		}
	}

	if (isPositiveDurationSeconds(part.duration)) {
		return { pieceUpdates }
	}

	if (usesMediaDuration && playableMediaDuration) {
		return {
			partDuration: playableMediaDuration,
			pieceUpdates
		}
	}

	let maxChild = 0
	for (const piece of livePieces) {
		if (usesMediaDuration && hasSourceDurationMetadata(piece)) {
			continue
		}
		if (isPositiveDurationSeconds(piece.duration)) {
			maxChild = Math.max(maxChild, piece.duration)
			continue
		}
		const trimmed = resolveTrimmedSourceDurationSeconds(piece)
		if (trimmed) {
			maxChild = Math.max(maxChild, trimmed)
		}
	}

	if (maxChild > 0) {
		return {
			partDuration: maxChild,
			pieceUpdates
		}
	}

	return { pieceUpdates }
}
