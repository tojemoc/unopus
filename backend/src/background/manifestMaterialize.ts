import { Part, TypeManifest, TypeManifestEntity } from './interfaces'

/**
 * Finds a type manifest by ID and optional entity type.
 * Performs case-insensitive matching and checks ingestType as fallback.
 * @param manifests - Array of type manifests to search.
 * @param typeId - The type ID to search for.
 * @param entityType - Optional entity type to filter by.
 * @returns The matching type manifest, or undefined if not found.
 */
export function findTypeManifest(
	manifests: TypeManifest[],
	typeId: string,
	entityType?: TypeManifestEntity
): TypeManifest | undefined {
	const scoped = entityType ? manifests.filter((m) => m.entityType === entityType) : manifests

	const exact = scoped.find((m) => m.id === typeId)
	if (exact) return exact

	const normalized = typeId.toLowerCase()
	const byId = scoped.find((m) => m.id.toLowerCase() === normalized)
	if (byId) return byId

	return scoped.find((m) => m.ingestType === typeId || m.ingestType?.toLowerCase() === normalized)
}

/**
 * Gets the ingest type for a part, using the manifest's ingestType if available.
 * @param part - The part object.
 * @param partManifest - Optional part type manifest.
 * @returns The ingest type string.
 */
export function getPartIngestType(part: Part, partManifest?: TypeManifest): string {
	return partManifest?.ingestType ?? part.partType
}

/**
 * Determines the piece name from a manifest, considering the includeTypeInName flag.
 * @param manifest - Optional type manifest for the piece.
 * @param fallback - Fallback name if manifest doesn't specify.
 * @returns The piece name to use.
 */
function pieceNameFromManifest(manifest: TypeManifest | undefined, fallback: string): string {
	if (manifest?.includeTypeInName) return manifest.name
	return fallback
}

export { pieceNameFromManifest }
