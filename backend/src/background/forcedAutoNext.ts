import { type TypeManifest, TypeManifestEntity } from './interfaces'

export const FORCED_AUTO_NEXT_TOOLTIP =
	"Sofie takes the next part automatically after this part's duration"

export interface ForcedAutoNextResult {
	forced: boolean
	/** Forced AUTO but no positive duration: Sofie cannot auto-take. */
	missingDuration: boolean
}

function findManifest(
	manifests: TypeManifest[] | null | undefined,
	id: string,
	entityType: TypeManifestEntity
): TypeManifest | undefined {
	return manifests?.find((m) => m.entityType === entityType && m.id === id)
}

/**
 * Data-driven mirror of the blueprint rule: AUTO is forced when the part type has
 * `autoNext` or any active piece type has `forcesAutoNext` in the manifests.
 */
export function resolveForcedAutoNext(
	manifests: TypeManifest[] | null | undefined,
	part: { partType: string; skip?: boolean; float?: boolean },
	pieces: Array<{ pieceType: string; skip?: boolean }>,
	effectiveDuration: number | undefined | null
): ForcedAutoNextResult {
	const forced =
		!part.skip &&
		!part.float &&
		(findManifest(manifests, part.partType, TypeManifestEntity.Part)?.autoNext === true ||
			pieces.some(
				(piece) =>
					!piece.skip &&
					findManifest(manifests, piece.pieceType, TypeManifestEntity.Piece)?.forcesAutoNext ===
						true
			))
	return {
		forced,
		missingDuration: forced && !(typeof effectiveDuration === 'number' && effectiveDuration > 0)
	}
}
