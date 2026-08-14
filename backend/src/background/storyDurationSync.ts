import { db } from './db.js'
import type { DBPart, DBPiece, Part, Piece } from './interfaces.js'
import {
	isPositiveDurationSeconds,
	planStoryDurationSync,
	type StoryDurationPiece
} from './storyDuration.js'

/** Serialize duration sync per story so concurrent saves cannot clobber each other. */
const syncTailByPartId = new Map<string, Promise<void>>()

/**
 * SQLite equivalent of `!isPositiveDurationSeconds(duration)`:
 * missing, null, zero, negative, JSON strings, booleans, and other non-numbers
 * are unset so the conditional UPDATE can repair them.
 */
export const UNSET_DURATION_SQL = `(
	JSON_TYPE(document, '$.duration') IS NULL
	OR JSON_TYPE(document, '$.duration') NOT IN ('integer', 'real')
	OR CAST(JSON_EXTRACT(document, '$.duration') AS REAL) <= 0
)`

function readPartRow(partId: string): Part | undefined {
	const row = db.prepare(`SELECT * FROM parts WHERE id = ? LIMIT 1`).get(partId) as DBPart | undefined
	if (!row) {
		return undefined
	}

	return {
		...JSON.parse(row.document),
		id: row.id,
		playlistId: row.playlistId,
		rundownId: row.rundownId,
		segmentId: row.segmentId
	}
}

function readPiecesForPart(partId: string): Piece[] {
	const rows = db.prepare(`SELECT * FROM pieces WHERE partId = ?`).all(partId) as unknown as DBPiece[]

	return rows.map((row) => ({
		...JSON.parse(row.document),
		id: row.id,
		playlistId: row.playlistId,
		rundownId: row.rundownId,
		segmentId: row.segmentId,
		partId: row.partId
	}))
}

function applyPieceDurationIfUnset(pieceId: string, duration: number): void {
	const patch = JSON.stringify({ duration })
	const result = db
		.prepare(
			`UPDATE pieces
			 SET document = (SELECT json_patch(pieces.document, json(?)) FROM pieces WHERE id = ?)
			 WHERE id = ? AND ${UNSET_DURATION_SQL}`
		)
		.run(patch, pieceId, pieceId)

	if (result.changes === 0) {
		const row = db.prepare(`SELECT document FROM pieces WHERE id = ?`).get(pieceId) as
			| { document: string }
			| undefined
		if (!row) {
			throw new Error(`Story duration sync failed: piece ${pieceId} not found`)
		}
		const stored = JSON.parse(row.document) as { duration?: number }
		if (!isPositiveDurationSeconds(stored.duration)) {
			throw new Error(`Story duration sync failed: could not set duration on piece ${pieceId}`)
		}
	}
}

function applyPartDurationIfUnset(partId: string, duration: number): void {
	const patch = JSON.stringify({ duration })
	const result = db
		.prepare(
			`UPDATE parts
			 SET document = (SELECT json_patch(parts.document, json(?)) FROM parts WHERE id = ?)
			 WHERE id = ? AND ${UNSET_DURATION_SQL}`
		)
		.run(patch, partId, partId)

	if (result.changes === 0) {
		const row = db.prepare(`SELECT document FROM parts WHERE id = ?`).get(partId) as
			| { document: string }
			| undefined
		if (!row) {
			throw new Error(`Story duration sync failed: part ${partId} not found`)
		}
		const stored = JSON.parse(row.document) as { duration?: number }
		if (!isPositiveDurationSeconds(stored.duration)) {
			throw new Error(`Story duration sync failed: could not set duration on part ${partId}`)
		}
	}
}

async function syncStoryDurationsForPartLocked(partId: string): Promise<void> {
	const part = readPartRow(partId)
	if (!part) {
		return
	}

	const pieces = readPiecesForPart(partId).map(
		(piece): StoryDurationPiece => ({
			id: piece.id,
			pieceType: piece.pieceType,
			duration: piece.duration
		})
	)

	const plan = planStoryDurationSync(part, pieces)

	db.exec('BEGIN IMMEDIATE')
	try {
		for (const pieceUpdate of plan.pieceUpdates) {
			const row = db.prepare(`SELECT document FROM pieces WHERE id = ?`).get(pieceUpdate.id) as
				| { document: string }
				| undefined
			if (!row) {
				throw new Error(`Story duration sync failed: piece ${pieceUpdate.id} not found`)
			}
			const stored = JSON.parse(row.document) as { duration?: number }
			if (isPositiveDurationSeconds(stored.duration)) {
				continue
			}
			if (stored.duration === pieceUpdate.duration) {
				continue
			}
			applyPieceDurationIfUnset(pieceUpdate.id, pieceUpdate.duration)
		}

		if (plan.partDuration !== undefined) {
			const row = db.prepare(`SELECT document FROM parts WHERE id = ?`).get(partId) as
				| { document: string }
				| undefined
			if (!row) {
				throw new Error(`Story duration sync failed: part ${partId} not found`)
			}
			const stored = JSON.parse(row.document) as { duration?: number }
			if (!isPositiveDurationSeconds(stored.duration) && stored.duration !== plan.partDuration) {
				applyPartDurationIfUnset(partId, plan.partDuration)
			}
		}

		db.exec('COMMIT')
	} catch (error) {
		try {
			db.exec('ROLLBACK')
		} catch {
			// ignore rollback errors when no transaction is open
		}
		throw error
	}
}

/** Persist inherited story/piece durations after a part or piece edit. */
export function syncStoryDurationsForPart(partId: string): Promise<void> {
	const previous = syncTailByPartId.get(partId) ?? Promise.resolve()
	const run = previous.then(() => syncStoryDurationsForPartLocked(partId))
	const tail = run.catch(() => undefined)
	syncTailByPartId.set(partId, tail)
	void tail.then(() => {
		if (syncTailByPartId.get(partId) === tail) {
			syncTailByPartId.delete(partId)
		}
	})
	return run
}
