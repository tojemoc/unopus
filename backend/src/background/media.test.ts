import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { db } from './db.js'
import {
	getBundledGfxTemplatesRoot,
	getPreviewBaseUrl,
	resolveGfxTemplateRoots
} from './media.js'
import { readApplicationSettingsSync } from './settingsResolver.js'

function clearSettingsPreviewBaseUrl(): () => void {
	const row = db
		.prepare(`SELECT document FROM settings WHERE id = 'settings'`)
		.get() as { document: string } | undefined
	if (!row) {
		return () => undefined
	}

	const parsed = JSON.parse(row.document) as Record<string, unknown>
	if (!('previewBaseUrl' in parsed)) {
		return () => undefined
	}

	const next = { ...parsed }
	delete next.previewBaseUrl
	db.prepare(`UPDATE settings SET document = json(?) WHERE id = 'settings'`).run(JSON.stringify(next))

	return () => {
		db.prepare(`UPDATE settings SET document = json(?) WHERE id = 'settings'`).run(row.document)
	}
}

describe('getPreviewBaseUrl', () => {
	it('falls back to default when PREVIEW_BASE_URL normalizes to an invalid suffix-only value', () => {
		const restoreSettings = clearSettingsPreviewBaseUrl()
		const previousPreviewBaseUrl = process.env.PREVIEW_BASE_URL
		try {
			process.env.PREVIEW_BASE_URL = '?cache=/'
			assert.equal(readApplicationSettingsSync()?.previewBaseUrl, undefined)
			assert.equal(getPreviewBaseUrl(), '/demo-assets')
		} finally {
			if (previousPreviewBaseUrl === undefined) {
				delete process.env.PREVIEW_BASE_URL
			} else {
				process.env.PREVIEW_BASE_URL = previousPreviewBaseUrl
			}
			restoreSettings()
		}
	})

	it('returns relative preview base URL segments from env', () => {
		const restoreSettings = clearSettingsPreviewBaseUrl()
		const previousPreviewBaseUrl = process.env.PREVIEW_BASE_URL
		try {
			process.env.PREVIEW_BASE_URL = 'gfx/'
			assert.equal(readApplicationSettingsSync()?.previewBaseUrl, undefined)
			assert.equal(getPreviewBaseUrl(), 'gfx')
		} finally {
			if (previousPreviewBaseUrl === undefined) {
				delete process.env.PREVIEW_BASE_URL
			} else {
				process.env.PREVIEW_BASE_URL = previousPreviewBaseUrl
			}
			restoreSettings()
		}
	})

	it('rewrites localhost absolute preview URLs to same-origin /demo-assets', () => {
		const restoreSettings = clearSettingsPreviewBaseUrl()
		const previousPreviewBaseUrl = process.env.PREVIEW_BASE_URL
		try {
			process.env.PREVIEW_BASE_URL = 'http://localhost:3010/demo-assets'
			assert.equal(getPreviewBaseUrl(), '/demo-assets')
			process.env.PREVIEW_BASE_URL = 'http://127.0.0.1:3010/demo-assets/'
			assert.equal(getPreviewBaseUrl(), '/demo-assets')
		} finally {
			if (previousPreviewBaseUrl === undefined) {
				delete process.env.PREVIEW_BASE_URL
			} else {
				process.env.PREVIEW_BASE_URL = previousPreviewBaseUrl
			}
			restoreSettings()
		}
	})
})

describe('resolveGfxTemplateRoots', () => {
	it('always includes bundled demo-assets as a fallback root', () => {
		const bundled = getBundledGfxTemplatesRoot()
		const roots = resolveGfxTemplateRoots()
		assert.ok(roots.includes(bundled), `expected bundled root ${bundled} in ${roots.join(', ')}`)
	})
})
