/**
 * Source toggle resolution for headline pieces.
 * Explicit true/'true' and false/'false' win; missing/null falls back to non-empty trimmed source
 * (legacy pieces that only stored `source` text).
 */
export function resolveSourceEnabled(enabledValue: unknown, sourceText: unknown): boolean {
	if (enabledValue === true || enabledValue === 'true') return true
	if (enabledValue === false || enabledValue === 'false') return false
	return typeof sourceText === 'string' && sourceText.trim().length > 0
}

export function trimSourceText(sourceText: unknown): string {
	return typeof sourceText === 'string' ? sourceText.trim() : ''
}
