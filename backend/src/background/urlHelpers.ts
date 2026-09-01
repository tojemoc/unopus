/**
 * Remove trailing slashes from a URL string.
 * Same-origin root (`/` / `///`) stays as `/` rather than becoming `''`.
 */
export function normalizeBaseUrl(url: string): string {
	const trimmed = url.trim()
	if (!trimmed) {
		return ''
	}
	const suffixIndex = trimmed.search(/[?#]/)
	if (suffixIndex === 0) {
		return ''
	}
	const path = suffixIndex === -1 ? trimmed : trimmed.slice(0, suffixIndex)
	const suffix = suffixIndex === -1 ? '' : trimmed.slice(suffixIndex)
	const withoutTrailing = path.replace(/\/+$/, '')
	return `${withoutTrailing === '' ? '/' : withoutTrailing}${suffix}`
}

/**
 * Check if a string is a valid HTTP or HTTPS URL.
 */
export function isValidHttpUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	} catch {
		return false
	}
}

/**
 * Absolute http(s) URL, or a same-origin path such as `/demo-assets` or `gfx/`.
 * Relative path segments (no leading slash) are normalized to same-origin paths by the client.
 */
export function isValidPreviewBaseUrl(url: string): boolean {
	const trimmed = url.trim()
	if (!trimmed) {
		return false
	}
	if (trimmed.startsWith('?') || trimmed.startsWith('#')) {
		return false
	}
	if (trimmed.startsWith('//')) {
		return false
	}
	if (trimmed.startsWith('/')) {
		return true
	}
	if (isValidHttpUrl(trimmed)) {
		return true
	}
	// Relative same-origin segment, e.g. gfx or gfx/templates (no protocol, no traversal).
	return /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(trimmed)
}
