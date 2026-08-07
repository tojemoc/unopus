import { fetchCoreContentStatusForRundown } from './coreContentStatus'
import {
	ManifestFieldType,
	TypeManifestEntity,
	type MediaFileEntry,
	type Piece,
	type TypeManifest
} from './interfaces'
import { findTypeManifest } from './manifestMaterialize'
import {
	aggregateCoreVerdictsForKey,
	normalizeMediaMatchKey,
	type CoreVerdictForJoin
} from './mediaPathKey'
import { getIngestMediaRoot } from './media'
import { mutations as piecesMutations } from './api/pieces'
import { mutations as typeManifestMutations } from './api/typeManifests'

function collectPieceMediaPaths(
	piece: Piece,
	manifest: TypeManifest | undefined
): Array<{ fieldId: string; path: string }> {
	if (!manifest?.payload?.length) {
		return []
	}
	const paths: Array<{ fieldId: string; path: string }> = []
	for (const field of manifest.payload) {
		if (field.type !== ManifestFieldType.MediaPick) continue
		const rawValue = piece.payload?.[field.id]
		const mediaPath = typeof rawValue === 'string' ? rawValue.trim() : ''
		if (!mediaPath) continue
		paths.push({ fieldId: field.id, path: mediaPath })
	}
	return paths
}

function unknownReadiness(files: MediaFileEntry[]): MediaFileEntry[] {
	return files.map((file) => ({
		...file,
		readiness: 'unknown' as const,
		reason: 'not yet confirmed by Package Manager'
	}))
}

/**
 * Attach Core/Package Manager readiness to filesystem media listings for the
 * active rundown only. Local fs existence never becomes confirmed/not-confirmed.
 */
export async function enrichMediaListingWithCoreReadiness(
	rundownId: string,
	files: MediaFileEntry[]
): Promise<MediaFileEntry[]> {
	const ingestRoot = getIngestMediaRoot()

	let pieces: Piece[]
	let manifests: TypeManifest[]
	let coreResult: Awaited<ReturnType<typeof fetchCoreContentStatusForRundown>>
	try {
		const { result: piecesResult } = await piecesMutations.read({ rundownId })
		pieces = Array.isArray(piecesResult)
			? piecesResult
			: piecesResult
				? [piecesResult]
				: []

		const { result: manifestsResult } = await typeManifestMutations.read({})
		manifests = (
			Array.isArray(manifestsResult)
				? manifestsResult
				: manifestsResult
					? [manifestsResult]
					: []
		).filter((manifest) => manifest.entityType === TypeManifestEntity.Piece)

		coreResult = await fetchCoreContentStatusForRundown(rundownId)
	} catch {
		return unknownReadiness(files)
	}

	// Only Package Manager answers become confirmed/not-confirmed — never invent from fs.
	const coreStatuses = coreResult.source === 'core' ? coreResult.statuses : undefined

	const verdicts: CoreVerdictForJoin[] = []
	for (const piece of pieces) {
		const coreStatus = coreStatuses?.get(piece.id)
		if (!coreStatus) {
			// No Core-sourced status for this piece — do not invent a verdict.
			continue
		}
		const manifest = findTypeManifest(manifests, piece.pieceType, TypeManifestEntity.Piece)
		for (const { fieldId, path: mediaPath } of collectPieceMediaPaths(piece, manifest)) {
			const matchKey = normalizeMediaMatchKey(mediaPath, ingestRoot)
			if (!matchKey) continue
			verdicts.push({
				pieceExternalId: piece.id,
				fieldId,
				matchKey,
				ready: coreStatus.ready,
				reason: coreStatus.reason
			})
		}
	}

	const byKey = new Map<string, CoreVerdictForJoin[]>()
	for (const verdict of verdicts) {
		const list = byKey.get(verdict.matchKey) ?? []
		list.push(verdict)
		byKey.set(verdict.matchKey, list)
	}

	return files.map((file) => {
		const key = normalizeMediaMatchKey(file.path, ingestRoot)
		const keyVerdicts = key ? (byKey.get(key) ?? []) : []
		const aggregated = aggregateCoreVerdictsForKey(keyVerdicts)
		return {
			...file,
			readiness: aggregated.readiness,
			reason: aggregated.reason
		}
	})
}
