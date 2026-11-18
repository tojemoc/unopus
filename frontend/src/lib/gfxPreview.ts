import { request } from './mediaApi'
import { isSameOriginPreviewBase } from './isSameOriginPreviewBase'

export { isSameOriginPreviewBase }

export type GfxTemplateMode = 'caspar' | 'query'

export interface GfxTemplateResolution {
	relativePath: string
	mode: GfxTemplateMode
}

export function joinPreviewPath(baseUrl: string, relativePath: string): string {
	const trimmedBase = baseUrl.replace(/\/+$/, '')
	const origin =
		trimmedBase.startsWith('/') || /^https?:\/\//i.test(trimmedBase)
			? trimmedBase
			: `/${trimmedBase}`
	return `${origin}/${relativePath.replace(/^\/+/, '')}`
}

export function buildQueryPreviewUrl(
	baseUrl: string,
	template: string,
	payload: Record<string, unknown>
): string {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(payload)) {
		if (value === undefined || value === null || value === '') {
			continue
		}
		params.set(key, String(value))
	}
	const query = params.toString()
	return `${joinPreviewPath(baseUrl, `${template}/index.html`)}${query ? `?${query}` : ''}`
}

export function buildCasparBridgePreviewUrl(
	baseUrl: string,
	relativePath: string
): string {
	const params = new URLSearchParams({ template: relativePath })
	return `${joinPreviewPath(baseUrl, '_gfx-preview-bridge.html')}?${params}`
}

export async function fetchGfxTemplateResolution(
	template: string
): Promise<GfxTemplateResolution | null> {
	try {
		const params = new URLSearchParams({ template })
		return await request<GfxTemplateResolution>(`/api/gfx/template?${params}`)
	} catch {
		return null
	}
}

/**
 * Deep link into the demo-assets GFX editor (`/preview/`): resolves the real
 * template id from the preview resolution (falling back to the manifest id)
 * and carries the current piece payload in `?data=`.
 */
export function buildGfxEditorUrl(
	template: string,
	resolution: GfxTemplateResolution | null | undefined,
	payload: Record<string, unknown>
): string {
	const leaf = resolution?.relativePath
		.replace(/\.html$/, '')
		.replace(/\/index$/, '')
		.split('/')
		.pop()
	const params = new URLSearchParams({ template: leaf || template })
	const data = JSON.stringify(payload)
	if (data !== '{}') {
		params.set('data', data)
	}
	return `/preview/?${params}`
}

export function buildCasparTemplateDataXml(payload: Record<string, unknown>): string {
	const components: string[] = []

	for (const [id, value] of Object.entries(payload)) {
		if (value === undefined || value === null || value === '') {
			continue
		}
		const safeId = escapeXmlAttribute(id)
		const text = String(value)
		const dataAttr = escapeXmlAttribute(text)
		components.push(
			`<componentData id="${safeId}"><data value="${dataAttr}">${escapeXmlText(text)}</data></componentData>`
		)
	}

	return `<templateData>${components.join('')}</templateData>`
}

function escapeXmlAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function escapeXmlText(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
}
