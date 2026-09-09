import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { db } from './db.js'
import { enrichMediaListingWithCoreReadiness } from './mediaListingReadiness.js'
import type { MediaFileEntry } from './interfaces.js'

function patchIgnoreCoreContentStatus(value: boolean): () => void {
	const row = db
		.prepare(`SELECT document FROM settings WHERE id = 'settings'`)
		.get() as { document: string } | undefined

	if (!row) {
		db.prepare(
			`INSERT INTO settings (id, document) VALUES ('settings', json(?))`
		).run(JSON.stringify({ ignoreCoreContentStatus: value }))
		return () => {
			db.prepare(`DELETE FROM settings WHERE id = 'settings'`).run()
		}
	}

	const previous = row.document
	const parsed = JSON.parse(previous) as Record<string, unknown>
	db.prepare(`UPDATE settings SET document = json(?) WHERE id = 'settings'`).run(
		JSON.stringify({ ...parsed, ignoreCoreContentStatus: value })
	)

	return () => {
		db.prepare(`UPDATE settings SET document = json(?) WHERE id = 'settings'`).run(previous)
	}
}

describe('enrichMediaListingWithCoreReadiness', () => {
	it('marks listed files confirmed from local FS when ignoreCoreContentStatus is on', async () => {
		const restore = patchIgnoreCoreContentStatus(true)
		try {
			const files: MediaFileEntry[] = [
				{ name: 'foo.mp4', path: 'clips/foo.mp4' },
				{ name: 'bar.mp4', path: 'clips/bar.mp4' }
			]
			const enriched = await enrichMediaListingWithCoreReadiness('any-rundown', files)
			assert.equal(enriched.length, 2)
			assert.equal(enriched[0]?.readiness, 'confirmed')
			assert.equal(enriched[1]?.readiness, 'confirmed')
			assert.equal(enriched[0]?.reason, undefined)
		} finally {
			restore()
		}
	})
})
