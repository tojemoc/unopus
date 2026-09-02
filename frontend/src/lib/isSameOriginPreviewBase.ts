export function isSameOriginPreviewBase(baseUrl: string): boolean {
	const trimmed = baseUrl.trim()
	if (!trimmed || trimmed.startsWith('?') || trimmed.startsWith('#') || trimmed.startsWith('//')) {
		return false
	}
	if (trimmed.startsWith('/')) {
		if (typeof window === 'undefined') {
			return false
		}
		try {
			const parsed = new URL(trimmed, window.location.href)
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
				return false
			}
			return parsed.origin === window.location.origin
		} catch {
			return false
		}
	}
	try {
		const parsed = new URL(trimmed)
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return false
		}
		if (typeof window !== 'undefined') {
			return parsed.origin === window.location.origin
		}
		return true
	} catch {
		return !trimmed.split('/').some((segment) => segment === '.' || segment === '..')
	}
}
