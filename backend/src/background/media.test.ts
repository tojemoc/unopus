import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
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
})
