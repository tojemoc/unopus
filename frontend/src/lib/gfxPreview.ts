import { request } from './mediaApi'
import { isSameOriginPreviewBase } from './isSameOriginPreviewBase'
import { formatPayloadStringValue } from '~/util/payloadStringValue'

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
		params.set(key, formatPayloadStringValue(value))
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

export function buildCasparTemplateDataXml(payload: Record<string, unknown>): string {
	const components: string[] = []

	for (const [id, value] of Object.entries(payload)) {
		if (value === undefined || value === null || value === '') {
			continue
		}
		const safeId = escapeXmlAttribute(id)
		const text = formatPayloadStringValue(value)
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
