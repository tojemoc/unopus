/**
 * SQLite `json_patch` implements RFC 7396 JSON Merge Patch:
 * - `null` deletes a key
 * - omitted keys are left unchanged
 * - `JSON.stringify` drops `undefined`, so clears never reach the DB unless encoded as `null`
 */

/**
 * Encode intentional clears of optional scalar fields as JSON `null`
 * so `json_patch` removes them from the stored document.
 */
export function encodeJsonMergePatchClears<T extends Record<string, unknown>>(
	patch: T,
	clearableKeys: readonly string[]
): T {
	const next = { ...patch } as Record<string, unknown>
	for (const key of clearableKeys) {
		if (!(key in next)) {
			continue
		}
		const value = next[key]
		if (value === undefined || value === null || value === '') {
			next[key] = null
		}
	}
	return next as T
}
