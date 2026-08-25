export function normalizeBaseUrl(url: string): string {
	return url.trim().replace(/\/+$/, '')
}

export function isValidHttpUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	} catch {
		return false
	}
}

/** Absolute http(s) URL, or a same-origin path such as `/demo-assets`. */
export function isValidPreviewBaseUrl(url: string): boolean {
	const trimmed = url.trim()
	if (!trimmed) {
		return false
	}
	if (trimmed.startsWith('/')) {
		return !trimmed.startsWith('//')
	}
	return isValidHttpUrl(trimmed)
}
