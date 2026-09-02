/**
 * Resolve a bridge iframe `template` query value to a same-origin http(s) URL.
 * Rejects javascript:, data:, and cross-origin absolute URLs.
 *
 * Keep demo-assets/gfx-preview-bridge-utils.mjs in sync when changing this logic.
 */
export function resolveBridgeTemplateSrc(
	templatePath: string | null | undefined,
	pageHref: string,
	pageOrigin: string
): string | null {
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
