import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { db } from './db.js'
import { getPreviewBaseUrl } from './media.js'
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

	const saved = parsed.previewBaseUrl
	const next = { ...parsed }
	delete next.previewBaseUrl
	db.prepare(`UPDATE settings SET document = json(?) WHERE id = 'settings'`).run(JSON.stringify(next))

	return () => {
		db.prepare(`UPDATE settings SET document = json(?) WHERE id = 'settings'`).run(row.document)
		void saved
	}
}

describe('getPreviewBaseUrl', () => {
	const originalPreviewBaseUrl = process.env.PREVIEW_BASE_URL

	afterEach(() => {
		if (originalPreviewBaseUrl === undefined) {
			delete process.env.PREVIEW_BASE_URL
		} else {
			process.env.PREVIEW_BASE_URL = originalPreviewBaseUrl
		}
	})

	it('falls back to default when PREVIEW_BASE_URL normalizes to an invalid suffix-only value', () => {
		const restoreSettings = clearSettingsPreviewBaseUrl()
		try {
			process.env.PREVIEW_BASE_URL = '?cache=/'
			assert.equal(readApplicationSettingsSync()?.previewBaseUrl, undefined)
			assert.equal(getPreviewBaseUrl(), '/demo-assets')
		} finally {
			restoreSettings()
		}
	})
})
