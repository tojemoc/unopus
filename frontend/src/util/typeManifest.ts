import type { TypeManifest } from '~backend/background/interfaces'

export function findTypeManifest(
	manifests: TypeManifest[] | null | undefined,
	typeId: string | undefined
): TypeManifest | undefined {
	if (!manifests || !typeId) return undefined

	const exact = manifests.find((m) => m.id === typeId)
	if (exact) return exact

	const normalized = typeId.toLowerCase()
	const byId = manifests.find((m) => m.id.toLowerCase() === normalized)
	if (byId) return byId

	return manifests.find(
		(m) => m.ingestType === typeId || m.ingestType?.toLowerCase() === normalized
	)
}

export function toolbarManifests(
	manifests: TypeManifest[] | null | undefined,
	entityType: TypeManifest['entityType']
): TypeManifest[] {
	return (
		manifests
			?.filter((m) => m.entityType === entityType)
			.filter((m) => m.showInToolbar !== false) ?? []
	)
}
