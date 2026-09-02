/**
 * Browser copy of backend/src/background/gfxPreviewBridge.ts — keep in sync.
 */
export function resolveBridgeTemplateSrc(templatePath, pageHref, pageOrigin) {
	if (!templatePath?.trim()) {
		return null
	}
	try {
		const parsed = new URL(templatePath, pageHref)
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return null
		}
		if (parsed.origin !== pageOrigin) {
			return null
		}
		return parsed.href
	} catch {
		return null
	}
}
