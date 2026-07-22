import type { TypeManifest, TypeManifestEntity } from '~backend/background/interfaces'

export function findTypeManifest(
	manifests: TypeManifest[] | null | undefined,
	typeId: string | undefined,
	entityType?: TypeManifestEntity
): TypeManifest | undefined {
	if (!manifests || !typeId) return undefined

	const scoped = entityType ? manifests.filter((m) => m.entityType === entityType) : manifests

	const exact = scoped.find((m) => m.id === typeId)
	if (exact) return exact

	const normalized = typeId.toLowerCase()
	const byId = scoped.find((m) => m.id.toLowerCase() === normalized)
	if (byId) return byId

	return scoped.find((m) => m.ingestType === typeId || m.ingestType?.toLowerCase() === normalized)
}

/** Resolve a piece/part type id to the canonical manifest id for comparisons */
export function normalizeTypeId(
	manifests: TypeManifest[] | null | undefined,
	typeId: string,
	entityType?: TypeManifestEntity
): string {
	return findTypeManifest(manifests, typeId, entityType)?.id ?? typeId.toLowerCase()
}

export function toolbarManifests(
	manifests: TypeManifest[] | null | undefined,
	entityType: TypeManifestEntity
): TypeManifest[] {
	return (
		manifests
			?.filter((m) => m.entityType === entityType)
			.filter((m) => m.showInToolbar !== false) ?? []
	)
}
