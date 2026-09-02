import fsSync from 'node:fs'
import path from 'path'
import { resolveGfxTemplateRoots } from './media.js'

export type GfxTemplateMode = 'caspar' | 'query'

export interface GfxTemplateResolution {
	/** Path relative to the preview base URL, e.g. `gfx/l3d-headline.html`. */
	relativePath: string
	mode: GfxTemplateMode
}

const TEMPLATE_CANDIDATES: ReadonlyArray<{
	buildPath: (template: string) => string
	mode: GfxTemplateMode
}> = [
	{ buildPath: (template) => path.posix.join('gfx', `${template}.html`), mode: 'caspar' },
	{ buildPath: (template) => `${template}.html`, mode: 'caspar' },
	{ buildPath: (template) => path.posix.join(template, 'index.html'), mode: 'query' }
]

/**
 * Sanitize a preview template id for filesystem lookup (no path segments).
 */
export function sanitizeGfxTemplateId(template: string): string {
	const sanitized = template.replace(/[/\\]/g, '').trim()
	if (sanitized === '.' || sanitized === '..') {
		return ''
	}
	return sanitized
}

/**
 * Resolve the first matching GFX template file across configured roots.
 *
 * Lookup order (first match wins):
 * 1. `gfx/{template}.html` — Caspar flat deploy (sofie-demo-template/gfx/)
 * 2. `{template}.html` — flat file at template root
 * 3. `{template}/index.html` — bundled query-param stubs
 */
export function resolveGfxTemplate(template: string): GfxTemplateResolution | null {
	const safeTemplate = sanitizeGfxTemplateId(template)
	if (!safeTemplate) {
		return null
	}

	for (const candidate of TEMPLATE_CANDIDATES) {
		for (const root of resolveGfxTemplateRoots()) {
			const relativePath = candidate.buildPath(safeTemplate)
			const absolutePath = path.join(root, relativePath)
			if (fsSync.existsSync(absolutePath)) {
				return { relativePath, mode: candidate.mode }
			}
		}
	}

	return null
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

/**
 * Build CasparCG-compatible templateData XML from a flat payload object.
 * Each key becomes `<componentData id="key"><data value="…"/></componentData>`.
 */
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

/**
 * True when the preview base URL is served from the same host as the editor.
 */
export function isSameOriginPreviewBase(baseUrl: string): boolean {
	const trimmed = baseUrl.trim()
	if (!trimmed || trimmed.startsWith('?') || trimmed.startsWith('#') || trimmed.startsWith('//')) {
		return false
	}
	if (trimmed.startsWith('/')) {
		return true
	}
	try {
		const parsed = new URL(trimmed)
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	} catch {
		// Relative segment such as `gfx` or `demo-assets`.
		return !trimmed.split('/').some((segment) => segment === '.' || segment === '..')
	}
}
