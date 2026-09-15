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
	entityType: TypeManifestEntity,
	options?: { includeTechOnly?: boolean }
): TypeManifest[] {
	const includeTech = options?.includeTechOnly === true
	return (
		manifests
			?.filter((m) => m.entityType === entityType)
			// techOnly visibility is role-gated only — ignore stale showInToolbar:false
			// left in the DB from older asset pins.
			.filter((m) => (m.techOnly ? includeTech : m.showInToolbar !== false))
			// Grouped types (e.g. L3D) get their own toolbar control.
			.filter((m) => !m.toolbarGroup) ?? []
	)
}

/** Piece types collapsed into one toolbar control (e.g. L3D variants). */
export function toolbarGroupedManifests(
	manifests: TypeManifest[] | null | undefined,
	entityType: TypeManifestEntity,
	groupId: string,
	options?: { includeTechOnly?: boolean }
): TypeManifest[] {
	const includeTech = options?.includeTechOnly === true
	return (
		manifests
			?.filter((m) => m.entityType === entityType)
			.filter((m) => m.toolbarGroup === groupId)
			.filter((m) => (m.techOnly ? includeTech : true)) ?? []
	)
}
