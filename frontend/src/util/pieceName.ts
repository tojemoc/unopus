import { ManifestFieldType, type PayloadManifest, type TypeManifest } from '~backend/background/interfaces'

const HEADLINE_FIELD_IDS = new Set(['text', 'headline', 'script'])

const PRIMARY_CONTENT_FIELD_IDS = new Set([
	'text',
	'headline',
	'script',
	'name',
	'kicker',
	'subline',
	'title',
	'role'
])

/** Media clip fields shown first (ILU / SYN / VO / VT). */
export function isPrimaryClipField(field: PayloadManifest): boolean {
	if (field.id === 'iluFile') {
		return true
	}
	if (field.type === ManifestFieldType.MediaPick && field.subdir === 'clips') {
		return true
	}
	return field.id === 'fileName' && field.subdir === 'clips'
}

export function isHeadlineField(field: PayloadManifest): boolean {
	return HEADLINE_FIELD_IDS.has(field.id)
}

export function isPrimaryContentField(field: PayloadManifest): boolean {
	return PRIMARY_CONTENT_FIELD_IDS.has(field.id)
}

export function isBypassField(field: PayloadManifest): boolean {
	return field.id === 'iluPrerendered' || field.id === 'bypass'
}

export function isSourceField(field: PayloadManifest): boolean {
	return field.id === 'sourceEnabled' || field.id === 'source'
}

/** Bypass clip picker paired with a bypass toggle (e.g. weather). */
export function isBypassClipField(field: PayloadManifest, manifest: TypeManifest | undefined): boolean {
	if (field.id !== 'fileName') {
		return false
	}
	return manifest?.payload?.some((f) => f.id === 'bypass') ?? false
}

function formatIncludeInNameValue(field: PayloadManifest, raw: unknown): string | undefined {
	if (raw === undefined || raw === null || raw === '') {
		return undefined
	}
	if (field.type === ManifestFieldType.MediaPick) {
		const path = String(raw)
		return path.split('/').pop() || path
	}
	const text = String(raw).trim()
	return text || undefined
}

/**
 * Derive the display/storage name from manifest rules and payload values.
 * Uses `includeTypeInName` on the type and `includeInName` on payload fields.
 */
export function resolvePieceName(
	manifest: TypeManifest | undefined,
	payload: Record<string, unknown> | undefined,
	fallback = 'New piece'
): string {
	if (!manifest) {
		return fallback
	}

	const parts: string[] = []

	if (manifest.includeTypeInName) {
		parts.push(manifest.shortName ?? manifest.name)
	}

	for (const field of manifest.payload ?? []) {
		if (!field.includeInName) {
			continue
		}
		const formatted = formatIncludeInNameValue(field, payload?.[field.id])
		if (formatted) {
			parts.push(formatted)
		}
	}

	if (parts.length === 0) {
		return manifest.name || fallback
	}

	return parts.join(': ')
}

/** First selected clip path for SYN/ILU preview, if any. */
export function resolveClipPreviewPath(
	manifest: TypeManifest | undefined,
	payload: Record<string, unknown> | undefined
): string | undefined {
	if (!manifest?.payload || !payload) {
		return undefined
	}

	for (const field of manifest.payload) {
		if (!isPrimaryClipField(field)) {
			continue
		}
		const value = payload[field.id]
		if (typeof value === 'string' && value.trim()) {
			return value.trim()
		}
	}
	return undefined
}
