import {
	DBPiece,
	IpcOperationType,
	MutatedPiece,
	MutationPieceCloneFromParToPart,
	MutationPieceCopy,
	MutationPieceCreate,
	MutationPieceDelete,
	MutationPieceRead,
	MutationPieceUpdate,
	MutationReorder,
	Piece,
	TypeManifestEntity
} from '../interfaces'
import { db } from '../db'
import { v4 as uuid } from 'uuid'
import { sendPartUpdateToCore } from './parts'
import { mutations as partsMutations } from './parts'
import { syncStoryDurationsForPart, broadcastStoryDurationSync } from '../storyDurationSync'
import { Server, Socket } from 'socket.io'
import { mutations as typeManifestMutations, resolveManifestId } from './typeManifests'
import { resolveSourceEnabled, trimSourceText } from '../sourcePayload'
import { spliceReorder, resolveReorderTargetIndex } from '../util'

export function comparePieceOrder(a: Piece, b: Piece): number {
	const rankA = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER
	const rankB = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER
	if (rankA !== rankB) return rankA - rankB

	const startA = a.start ?? 0
	const startB = b.start ?? 0
	if (startA !== startB) return startA - startB

	return a.id.localeCompare(b.id)
}

function getNextPieceRank(partId: string): number {
	const rows = db
		.prepare(`SELECT id, document FROM pieces WHERE partId = ?`)
		.all(partId) as Array<{ id: string; document: string }>

	const pieces = rows.map((row) => {
		const document = JSON.parse(row.document) as Omit<Piece, 'id'>
		return { ...document, id: row.id } as Piece
	})

	const hasExplicitRank = pieces.some((piece) => typeof piece.rank === 'number')

	// Unranked legacy pieces sort at Number.MAX_SAFE_INTEGER. A finite append rank
	// (e.g. rows.length) would appear *before* them — materialize 0..n-1 first.
	if (!hasExplicitRank && pieces.length > 0) {
		const ordered = [...pieces].sort(comparePieceOrder)
		const updateStmt = db.prepare(`
			UPDATE pieces
			SET document = (SELECT json_patch(pieces.document, json(?)) FROM pieces WHERE id = ?)
			WHERE id = ?;
		`)
		ordered.forEach((piece, index) => {
			updateStmt.run(JSON.stringify({ rank: index }), piece.id, piece.id)
		})
		return ordered.length
	}

	let maxRank = -1
	for (const piece of pieces) {
		if (typeof piece.rank === 'number') {
			maxRank = Math.max(maxRank, piece.rank)
		}
	}

	return maxRank + 1
}

export const mutations = {
	async create(payload: MutationPieceCreate): Promise<{ result?: Piece; error?: Error }> {
		const { result: pieceTypeManifests } = await typeManifestMutations.read({
			entityType: TypeManifestEntity.Piece
		})

		const pieceTypeManifestList = Array.isArray(pieceTypeManifests) ? pieceTypeManifests : []

		const defaultPieceType = pieceTypeManifestList[0]?.id
		if (!defaultPieceType) {
			return { error: new Error('No piece type manifests exist') }
		}
		const payloadHasType = payload.pieceType && payload.pieceType !== ''

		let resolvedPieceType = defaultPieceType
		if (payloadHasType) {
			const matchedPieceType = resolveManifestId(String(payload.pieceType), pieceTypeManifestList)
			if (!matchedPieceType) {
				return { error: new Error(`Invalid piece type: ${payload.pieceType}`) }
			}
			resolvedPieceType = matchedPieceType
		}

		const id = payload.id || uuid()
		const document: Partial<MutationPieceCreate> = {
			...payload,
			pieceType: payloadHasType ? resolvedPieceType : defaultPieceType,
			start: payload.start ?? 0,
			rank: payload.rank ?? getNextPieceRank(payload.partId)
		}
		delete document.playlistId
		delete document.rundownId
		delete document.segmentId
		delete document.partId

		if (!payload.rundownId || !payload.partId)
			return { error: new Error('Missing rundown id or part id') }

		try {
			const stmt = db.prepare(`
				INSERT INTO pieces (id,playlistId,rundownId,segmentId,partId,document)
				VALUES (?,?,?,?,?,json(?));
			`)

			const result = stmt.run(
				id,
				payload.playlistId || null,
				payload.rundownId,
				payload.segmentId,
				payload.partId,
				JSON.stringify(document)
			)
			if (result.changes === 0) throw new Error('No rows were inserted')

			return this.readOne(id)
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	/**
	 * Copy an existing Piece.
	 *
	 * This function creates a new `Piece` record by duplicating the data of an existing one.
	 * If a `partId` is provided, the cloned piece will be created inside that target part.
	 * If no `partId` is given, the cloned piece will be created within the same part
	 * as the source piece.
	 *
	 * @async
	 * @param {Object} payload - The clone parameters.
	 * @param {string} payload.id - The ID of the source piece to clone.
	 * @param {string} [payload.partId] - Optional target part ID where the cloned piece should be placed.
	 * @returns {Promise<{ result?: Piece; error?: Error }>}
	 * Returns an object containing either the newly cloned `Piece` (`result`)
	 * or an `Error` (`error`) if the operation fails.
	 */
	async createPieceCopy(payload: MutationPieceCopy) {
		{
			let returnedError: unknown | Error | undefined
			let result: Piece | undefined

			const { result: sourcePiece, error: pieceReadError } = await mutations.readOne(payload.id)

			try {
				if (pieceReadError || !sourcePiece) returnedError = pieceReadError
				else {
					let targetPartId = payload.partId || sourcePiece.partId
					let targetPlaylistId = sourcePiece.playlistId
					let targetRundownId = sourcePiece.rundownId
					let targetSegmentId = sourcePiece.segmentId

					// If a partId was passed, read its metadata for the new piece
					if (payload.partId && payload.partId !== sourcePiece.partId) {
						const { result: targetPart, error: partError } = await partsMutations.readOne(
							payload.partId
						)
						if (partError || !targetPart) throw partError || new Error('Target part not found')

						targetPlaylistId = targetPart.playlistId
						targetRundownId = targetPart.rundownId
						targetSegmentId = targetPart.segmentId
					}

					const { result: newPiece, error: createError } = await mutations.create({
						...sourcePiece,
						playlistId: targetPlaylistId,
						rundownId: targetRundownId,
						segmentId: targetSegmentId,
						partId: targetPartId,
						name: `${sourcePiece.name}${!payload.preserveName ? ' Copy' : ''}`,
						id: undefined,
						rank: undefined
					})

					if (createError) returnedError = createError
					else result = newPiece
				}
			} catch (e) {
				returnedError = e
			}

			return { result: !returnedError ? result : undefined, error: returnedError }
		}
	},
	async readOne(id: string): Promise<{ result?: Piece; error?: Error }> {
		try {
			const stmt = db.prepare(`
						SELECT *
						FROM pieces
						WHERE id = ?
						LIMIT 1;
					`)

			const document = stmt.get(id) as DBPiece | undefined
			if (!document) {
				return { error: new Error(`Piece with id ${id} not found`) }
			}

			return {
				result: {
					...JSON.parse(document.document),
					id: document.id,
					playlistId: document.playlistId,
					rundownId: document.rundownId,
					segmentId: document.segmentId,
					partId: document.partId
				}
			}
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async read(
		payload: Partial<MutationPieceRead>
	): Promise<{ result?: Piece | Piece[]; error?: Error }> {
		if (payload && payload.id) {
			return this.readOne(payload.id)
		}

		let query = `
			SELECT *
			FROM pieces
		`
		const args: string[] = []
		const conditions: string[] = []
		if (payload.id) {
			conditions.push(`id = ?`)
			args.push(payload.id)
		}
		if (payload.rundownId) {
			conditions.push(`rundownId = ?`)
			args.push(payload.rundownId)
		}
		if (payload.segmentId) {
			conditions.push(`segmentId = ?`)
			args.push(payload.segmentId)
		}
		if (payload.partId) {
			conditions.push(`partId = ?`)
			args.push(payload.partId)
		}

		if (conditions.length > 0) {
			query += `\nWHERE ${conditions.join(' AND ')}`
		}

		try {
			const stmt = db.prepare(query)

			const documents = stmt.all(...args) as unknown as DBPiece[]

			return {
				result: documents
					.map((d) => ({
						...JSON.parse(d.document),
						id: d.id,
						playlistId: d.playlistId,
						rundownId: d.rundownId,
						segmentId: d.segmentId,
						partId: d.partId
					}))
					.sort(comparePieceOrder)
			}
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async update(payload: MutationPieceUpdate): Promise<{ result?: Piece; error?: Error }> {
		const update = {
			...payload,
			id: null,
			playlistId: null,
			rundownId: null,
			segmentId: null,
			partId: null
		}

		try {
			const stmt = db.prepare(`
				UPDATE pieces
				SET playlistId = ?, document = (SELECT json_patch(pieces.document, json(?)) FROM pieces WHERE id = ?)
				WHERE id = ?;
			`)

			const result = stmt.run(
				payload.playlistId || null,
				JSON.stringify(update),
				payload.id,
				payload.id
			)
			if (result.changes === 0) {
				throw new Error('No rows were updated')
			}

			return this.readOne(payload.id)
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async reorder({
		element,
		sourceIndex,
		targetIndex
	}: MutationReorder<MutationPieceUpdate>): Promise<{ result?: Piece[]; error?: Error }> {
		try {
			const { result, error } = await this.read({
				partId: element.partId
			})

			if (error) throw error
			if (result && (!('length' in result) || result.length < 2)) {
				throw new Error('An error occurred when getting pieces from the database during reorder.')
			}

			const piecesInOrder = [...(result as Piece[])].sort(comparePieceOrder)
			const resolvedSourceIndex = piecesInOrder.findIndex((piece) => piece.id === element.id)
			if (resolvedSourceIndex === -1) {
				throw new Error(`Piece with id ${element.id} not found during reorder`)
			}

			const resolvedTargetIndex = resolveReorderTargetIndex(
				resolvedSourceIndex,
				sourceIndex,
				targetIndex,
				piecesInOrder.length
			)
			const reorderedPieces = spliceReorder(piecesInOrder, resolvedSourceIndex, resolvedTargetIndex)

			db.exec('BEGIN;')
			try {
				const updateStmt = db.prepare(`
				UPDATE pieces
				SET playlistId = ?, document = (SELECT json_patch(pieces.document, json(?)) FROM pieces WHERE id = ?)
				WHERE id = ?;
			`)

				reorderedPieces.forEach((piece, index) => {
					updateStmt.run(
						piece.playlistId || null,
						JSON.stringify({ rank: index }),
						piece.id,
						piece.id
					)
				})

				db.exec('COMMIT;')
			} catch (transactionError) {
				console.error(transactionError)
				db.exec('ROLLBACK;')
				throw transactionError
			}

			const { result: updatedPieces, error: updatedPiecesError } = await this.read({
				partId: element.partId
			})

			if (updatedPiecesError) throw updatedPiecesError
			if (!updatedPieces || !Array.isArray(updatedPieces)) {
				throw new Error('Failed to read pieces after reorder.')
			}

			return { result: updatedPieces }
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async delete(payload: MutationPieceDelete): Promise<{ error?: Error }> {
		try {
			const stmt = db.prepare(`
				DELETE FROM pieces
				WHERE id = ?;
			`)

			stmt.run(payload.id)
			return {}
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async cloneFromPartToPart({
		fromPartId,
		toPartId
	}: MutationPieceCloneFromParToPart): Promise<{ result?: Piece[]; error?: Error }> {
		try {
			const { result: fromPart } = await partsMutations.readOne(fromPartId)
			const { result: toPart } = await partsMutations.readOne(toPartId)

			if (!fromPart || !toPart) {
				throw new Error('Either the source or target Part was not found')
			}

			const { result: sourcePiecesResult } = await mutations.read({ partId: fromPartId })
			const sourcePieces = Array.isArray(sourcePiecesResult)
				? sourcePiecesResult
				: sourcePiecesResult
					? [sourcePiecesResult]
					: []
			if (sourcePieces) {
				return {
					result: (
						await Promise.all(
							sourcePieces.map(async (piece) => {
								return await mutations.createPieceCopy({
									id: piece.id,
									partId: toPart.id,
									preserveName: true
								})
							})
						)
					).map((p) => {
						if (p.error) throw p.error
						return p.result as Piece
					})
				}
			} else {
				throw new Error(`Couldn't find source pieces`)
			}
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	}
}

export function registerPiecesHandlers(socket: Socket, io: Server) {
	socket.on('pieces', async (action, payload, callback) => {
		switch (action) {
			case IpcOperationType.Create:
				{
					const { result, error } = await handleCreatePiece(payload, io)
					callback(result || error)
				}
				break
			case IpcOperationType.Copy:
				{
					const { result, error } = await handleCopyPiece(payload)
					callback(result || error)
				}
				break
			case IpcOperationType.Read:
				{
					const { result, error } = await mutations.read(payload)
					callback(result || error)
				}
				break
			case IpcOperationType.Update:
				{
					const { result, error } = await handleUpdatePiece(payload, io)
					callback(result || error)
				}
				break
			case IpcOperationType.Reorder:
				{
					const { result, error } = await handleReorderPieces(payload, io)
					callback(result || error)
				}
				break
			case IpcOperationType.Delete:
				{
					const { result, error } = await handleDeletePiece(payload)
					callback(result || error)
				}
				break
			default:
				callback(new Error(`Unknown operation type ${action}`))
		}
	})
}

async function handleCreatePiece(payload: MutationPieceCreate, io?: Server) {
	{
		let returnedError: unknown | Error | undefined

		const { result, error: createError } = await mutations.create(payload)

		if (createError) returnedError = createError

		if (result) {
			try {
				await syncStoryDurationsForPart(result.partId)
				if (io) broadcastStoryDurationSync(io, result.partId)
			} catch (error) {
				console.error('Failed to sync story durations for part', result.partId, error)
				returnedError = error instanceof Error ? error : new Error(String(error))
			}
			if (!returnedError) {
				try {
					await sendPartUpdateToCore(result.partId)
				} catch (error) {
					console.error(error)
					returnedError = error instanceof Error ? error : new Error(String(error))
				}
			}
		}

		const { result: syncedPiece } =
			result && !returnedError ? await mutations.readOne(result.id) : { result: undefined }

		return { result: syncedPiece ?? result, error: returnedError }
	}
}

async function handleCopyPiece(payload: MutationPieceCopy) {
	let returnedError: unknown | Error | undefined

	const { result, error: cloneError } = await mutations.createPieceCopy(payload)

	if (cloneError) returnedError = cloneError

	if (result) {
		try {
			await sendPartUpdateToCore(result.partId)
		} catch (error) {
			console.error(error)
			returnedError = error
		}
	}

	return { result, error: returnedError }
}

async function handleUpdatePiece(payload: MutationPieceUpdate, io?: Server) {
	{
		let returnedError: unknown | Error | undefined

		const { result, error: updateError } = await mutations.update(payload)

		if (updateError) returnedError = updateError

		if (result) {
			try {
				await syncStoryDurationsForPart(result.partId)
				if (io) broadcastStoryDurationSync(io, result.partId)
			} catch (error) {
				console.error('Failed to sync story durations for part', result.partId, error)
				returnedError = error instanceof Error ? error : new Error(String(error))
			}
			if (!returnedError) {
				try {
					await sendPartUpdateToCore(result.partId)
				} catch (error) {
					console.error(error)
					returnedError = error instanceof Error ? error : new Error(String(error))
				}
			}
		}

		const { result: syncedPiece } =
			result && !returnedError ? await mutations.readOne(result.id) : { result: undefined }

		return { result: syncedPiece ?? result, error: returnedError }
	}
}

async function handleReorderPieces(payload: MutationReorder<MutationPieceUpdate>, io?: Server) {
	let returnedError: unknown | Error | undefined

	const { result: reorderedPieces, error: reorderError } = await mutations.reorder(payload)

	if (reorderError) returnedError = reorderError

	if (!reorderError && Array.isArray(reorderedPieces)) {
		if (io) {
			io.emit('pieces:update', { action: 'update', pieces: reorderedPieces })
		}

		try {
			await sendPartUpdateToCore(reorderedPieces[0].partId)
		} catch (error) {
			console.error(error)
			returnedError = error instanceof Error ? error : new Error(String(error))
		}
	}

	return { result: returnedError === undefined ? reorderedPieces : undefined, error: returnedError }
}

async function handleDeletePiece(payload: MutationPieceDelete) {
	{
		let returnedError: unknown | Error | undefined

		const { result: document } = await mutations.read({ id: payload.id })
		const { error: deleteError } = await mutations.delete(payload)

		if (deleteError) returnedError = deleteError

		if (!deleteError && document && !Array.isArray(document)) {
			try {
				await sendPartUpdateToCore(document.partId)
			} catch (error) {
				console.error(error)
				returnedError = error
			}
		}

		return { result: returnedError === undefined ? true : undefined, error: returnedError }
	}
}

export async function handleCloneSetPiece(payload: MutationPieceCloneFromParToPart) {
	{
		let returnedError: unknown | Error | undefined

		const { result, error: cloneError } = await mutations.cloneFromPartToPart(payload)

		if (cloneError) returnedError = cloneError

		if (result) {
			try {
				await sendPartUpdateToCore(payload.toPartId)
			} catch (error) {
				console.error(error)
				returnedError = error
			}
		}

		return { result, error: returnedError }
	}
}

function normalizeGraphicAttributesForExport(
	payload: Piece['payload'] | undefined
): Record<string, unknown> {
	const attributes: Record<string, unknown> = { ...(payload ?? {}) }

	const sourceText = trimSourceText(attributes.source)
	const sourceEnabled = resolveSourceEnabled(attributes.sourceEnabled, sourceText)

	delete attributes.sourceEnabled

	// Only send a non-empty source when the toggle is on (avoids an empty on-air pill).
	if (!sourceEnabled || !sourceText) {
		delete attributes.source
	} else {
		attributes.source = sourceText
	}

	return attributes
}

export function mutatePieceForExport(piece: Piece): MutatedPiece {
	const objectTime = piece.start ?? 0

	return {
		id: piece.id,
		name: piece.name,
		objectType: piece.pieceType,
		objectTime,
		duration: piece.duration,
		clipName: undefined,
		attributes: {
			...normalizeGraphicAttributesForExport(piece.payload),
			adlib: false
		},
		position: undefined
	}
}

export async function getMutatedPiecesFromPart(partId: string): Promise<MutatedPiece[]> {
	const { result: pieces } = await mutations.read({ partId: partId })

	if (pieces && Array.isArray(pieces)) {
		return pieces.map((piece) => mutatePieceForExport(piece))
	}

	return []
}
