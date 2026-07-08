import { Part, TypeManifest } from './interfaces'

export function findTypeManifest(
	manifests: TypeManifest[],
	typeId: string
): TypeManifest | undefined {
	const exact = manifests.find((m) => m.id === typeId)
	if (exact) return exact

	const normalized = typeId.toLowerCase()
	const byId = manifests.find((m) => m.id.toLowerCase() === normalized)
	if (byId) return byId

	return manifests.find(
		(m) => m.ingestType === typeId || m.ingestType?.toLowerCase() === normalized
	)
}

export function getPartIngestType(part: Part, partManifest?: TypeManifest): string {
	return partManifest?.ingestType ?? part.partType
}

function pieceNameFromManifest(manifest: TypeManifest | undefined, fallback: string): string {
	if (manifest?.includeTypeInName) return manifest.name
	return fallback
}

export { pieceNameFromManifest }
