import { Part, TypeManifest, TypeManifestEntity } from './interfaces'

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

export function getPartIngestType(part: Part, partManifest?: TypeManifest): string {
	return partManifest?.ingestType ?? part.partType
}

function pieceNameFromManifest(manifest: TypeManifest | undefined, fallback: string): string {
	if (manifest?.includeTypeInName) return manifest.name
	return fallback
}

export { pieceNameFromManifest }
