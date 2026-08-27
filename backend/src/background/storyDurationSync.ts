import { db } from './db.js'
import type { DBPart, DBPiece, Part, Piece } from './interfaces.js'
import { readApplicationSettingsSync } from './settingsResolver.js'
import {
	isPositiveDurationSeconds,
	planStoryDurationSync,
	type StoryDurationPiece
} from './storyDuration.js'
import { resolveEffectiveScriptCps } from './scriptReadingTime.js'

/** Serialize duration sync per story so concurrent saves cannot clobber each other. */
const syncTailByPartId = new Map<string, Promise<void>>()

let beforeLocked: ((partId: string) => Promise<void>) | undefined

/** Test-only seam to observe/hold the locked sync path. */
export function setStoryDurationSyncBeforeLocked(
	hook: ((partId: string) => Promise<void>) | undefined
): void {
	beforeLocked = hook
}

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

/**
 * Read a single part from the database by ID.
 */
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

/**
 * Read all pieces for a given part from the database.
 */
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

/**
 * Update piece duration in DB only if currently unset (conditional update).
 */
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

/**
 * Update part duration in DB only if currently unset (conditional update).
 */
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

/** Push synced part/piece rows to connected RE clients (after DB inheritance). */
export function broadcastStoryDurationSync(
	io: { emit: (event: string, payload: unknown) => void },
	partId: string
): void {
	const part = readPartRow(partId)
	const pieces = readPiecesForPart(partId)

	if (part) {
		io.emit('parts:update', { action: 'update', parts: [part] })
	}
	if (pieces.length > 0) {
		io.emit('pieces:update', { action: 'update', pieces })
	}
}

/**
 * Update piece duration in DB, optionally forcing overwrite of existing values.
 */
function applyPieceDuration(pieceId: string, duration: number, force: boolean): void {
	const patch = JSON.stringify({ duration })
	if (force) {
		db.prepare(
			`UPDATE pieces
			 SET document = (SELECT json_patch(pieces.document, json(?)) FROM pieces WHERE id = ?)
			 WHERE id = ?`
		).run(patch, pieceId, pieceId)
		return
	}
	applyPieceDurationIfUnset(pieceId, duration)
}

/**
 * Update part duration in DB, optionally forcing overwrite of existing values.
 */
function applyPartDuration(partId: string, duration: number, force: boolean): void {
	const patch = JSON.stringify({ duration })
	if (force) {
		db.prepare(
			`UPDATE parts
			 SET document = (SELECT json_patch(parts.document, json(?)) FROM parts WHERE id = ?)
			 WHERE id = ?`
		).run(patch, partId, partId)
		return
	}
	applyPartDurationIfUnset(partId, duration)
}

/**
 * Internal sync implementation that runs inside the per-part queue.
 * Computes and persists inherited durations within a transaction.
 */
async function syncStoryDurationsForPartLocked(
	partId: string,
	options?: { editorScriptCps?: number | null }
): Promise<void> {
	if (beforeLocked) {
		await beforeLocked(partId)
	}

	const part = readPartRow(partId)
	if (!part) {
		return
	}

	const settings = readApplicationSettingsSync()
	const scriptCps = resolveEffectiveScriptCps(options?.editorScriptCps, settings?.scriptCps)
	const pieces = readPiecesForPart(partId).map(
		(piece): StoryDurationPiece => ({
			id: piece.id,
			pieceType: piece.pieceType,
			duration: piece.duration,
			skip: piece.skip,
			payload: piece.payload
		})
	)

	const plan = planStoryDurationSync(
		{
			duration: part.duration,
			script: part.script,
			partType: part.partType,
			skip: part.skip
		},
		pieces,
		{ scriptCps }
	)

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
			if (stored.duration === pieceUpdate.duration) {
				continue
			}
			if (!pieceUpdate.force && isPositiveDurationSeconds(stored.duration)) {
				continue
			}
			applyPieceDuration(pieceUpdate.id, pieceUpdate.duration, Boolean(pieceUpdate.force))
		}

		if (plan.partDuration !== undefined) {
			const row = db.prepare(`SELECT document FROM parts WHERE id = ?`).get(partId) as
				| { document: string }
				| undefined
			if (!row) {
				throw new Error(`Story duration sync failed: part ${partId} not found`)
			}
			const stored = JSON.parse(row.document) as { duration?: number }
			if (stored.duration === plan.partDuration) {
				// already in sync
			} else if (plan.forcePartDuration || !isPositiveDurationSeconds(stored.duration)) {
				applyPartDuration(partId, plan.partDuration, Boolean(plan.forcePartDuration))
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
export function syncStoryDurationsForPart(
	partId: string,
	options?: { editorScriptCps?: number | null }
): Promise<void> {
	const previous = syncTailByPartId.get(partId) ?? Promise.resolve()
	const run = previous.then(() => syncStoryDurationsForPartLocked(partId, options))
	const tail = run.catch(() => undefined)
	syncTailByPartId.set(partId, tail)
	void tail.then(() => {
		if (syncTailByPartId.get(partId) === tail) {
			syncTailByPartId.delete(partId)
		}
	})
	return run
}
