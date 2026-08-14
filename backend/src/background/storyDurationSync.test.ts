import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import sqlite from 'node:sqlite'
import { db } from './db.js'
import { isPositiveDurationSeconds } from './storyDuration.js'
import { UNSET_DURATION_SQL, syncStoryDurationsForPart } from './storyDurationSync.js'

describe('UNSET_DURATION_SQL', () => {
	it('matches isPositiveDurationSeconds for JSON duration shapes', () => {
		const mem = new sqlite.DatabaseSync(':memory:')
		mem.exec('CREATE TABLE docs (id TEXT PRIMARY KEY, document JSON NOT NULL)')
		const insert = mem.prepare('INSERT INTO docs (id, document) VALUES (?, ?)')

		const cases: Array<{ id: string; document: Record<string, unknown> }> = [
			{ id: 'missing', document: {} },
			{ id: 'null', document: { duration: null } },
			{ id: 'zero', document: { duration: 0 } },
			{ id: 'neg', document: { duration: -2 } },
			{ id: 'pos-int', document: { duration: 8 } },
			{ id: 'pos-real', document: { duration: 8.5 } },
			{ id: 'str', document: { duration: '8' } },
			{ id: 'true', document: { duration: true } },
			{ id: 'false', document: { duration: false } }
		]

		for (const row of cases) {
			insert.run(row.id, JSON.stringify(row.document))
		}

		const select = mem.prepare(`SELECT ${UNSET_DURATION_SQL} AS unset FROM docs WHERE id = ?`)

		for (const row of cases) {
			const sqlUnset = Boolean(select.get(row.id)?.unset)
			const jsUnset = !isPositiveDurationSeconds(row.document.duration as number | undefined | null)
			assert.equal(sqlUnset, jsUnset, `${row.id}: SQL unset=${sqlUnset} JS unset=${jsUnset}`)
		}
	})
})

describe('syncStoryDurationsForPart', () => {
	const partId = 'story-duration-sync-test-part'
	const pieceId = 'story-duration-sync-test-piece'
	const rundownId = 'story-duration-sync-test-rundown'
	const segmentId = 'story-duration-sync-test-segment'

	after(() => {
		db.prepare(`DELETE FROM pieces WHERE id = ?`).run(pieceId)
		db.prepare(`DELETE FROM parts WHERE id = ?`).run(partId)
		db.prepare(`DELETE FROM segments WHERE id = ?`).run(segmentId)
		db.prepare(`DELETE FROM rundowns WHERE id = ?`).run(rundownId)
	})

	it('repairs JSON string piece duration via the unset UPDATE path', async () => {
		db.prepare(
			`INSERT OR REPLACE INTO rundowns (id, playlistId, document) VALUES (?, NULL, ?)`
		).run(rundownId, JSON.stringify({ name: 'sync-test' }))
		db.prepare(
			`INSERT OR REPLACE INTO segments (id, playlistId, rundownId, document) VALUES (?, NULL, ?, ?)`
		).run(segmentId, rundownId, JSON.stringify({ name: 'sync-test-seg', rank: 0 }))
		db.prepare(
			`INSERT OR REPLACE INTO parts (id, playlistId, rundownId, segmentId, document) VALUES (?, NULL, ?, ?, ?)`
		).run(
			partId,
			rundownId,
			segmentId,
			JSON.stringify({ name: 'sync-test-part', rank: 0, duration: 6 })
		)
		db.prepare(
			`INSERT OR REPLACE INTO pieces (id, playlistId, rundownId, segmentId, partId, document) VALUES (?, NULL, ?, ?, ?, ?)`
		).run(
			pieceId,
			rundownId,
			segmentId,
			partId,
			JSON.stringify({ name: 'mod', pieceType: 'l3d-mod', duration: '8', rank: 0 })
		)

		await syncStoryDurationsForPart(partId)

		const row = db.prepare(`SELECT document FROM pieces WHERE id = ?`).get(pieceId) as {
			document: string
		}
		const stored = JSON.parse(row.document) as { duration?: unknown }
		assert.equal(stored.duration, 6)
	})

	it('chains concurrent calls and still settles', async () => {
		const first = syncStoryDurationsForPart(partId)
		const second = syncStoryDurationsForPart(partId)
		await Promise.all([first, second])

		const row = db.prepare(`SELECT document FROM pieces WHERE id = ?`).get(pieceId) as {
			document: string
		}
		const stored = JSON.parse(row.document) as { duration?: unknown }
		assert.equal(stored.duration, 6)
	})
})
