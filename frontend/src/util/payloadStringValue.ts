/**
 * Coerce a payload value into text for a manifest `string` field.
 *
 * Objects/arrays must use JSON.stringify — `String([{…}])` becomes
 * `"[object Object],[object Object]"`, which is what broke Cities JSON.
 */
export function formatPayloadStringValue(value: unknown): string {
	if (value === undefined || value === null) {
		return ''
	}
	if (typeof value === 'string') {
		return value
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? String(value) : ''
	}
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false'
	}
	try {
		return JSON.stringify(value)
	} catch {
		return String(value)
	}
}

/**
 * Ensure every manifest-declared string field is stored as a string
 * (e.g. imported smoke rundowns that put `cities` in as a JSON array).
 */
export function normalizeStringTypedPayload(
	payload: Record<string, unknown> | undefined,
	stringFieldIds: Iterable<string>
): Record<string, unknown> {
	const next: Record<string, unknown> = { ...(payload ?? {}) }
	for (const id of stringFieldIds) {
		if (!Object.prototype.hasOwnProperty.call(next, id)) {
			continue
		}
		const value = next[id]
		if (value !== undefined && value !== null && typeof value !== 'string') {
			next[id] = formatPayloadStringValue(value)
		}
	}
	return next
}
