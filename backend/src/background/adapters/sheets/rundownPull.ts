import { mutations as partMutations } from '../../api/parts'
import { mutations as pieceMutations } from '../../api/pieces'
import { mutations as segmentMutations } from '../../api/segments'
import type { ApplicationSettings, Part, Piece, PayloadValue } from '../../interfaces'
import {
	applyFieldMappingsToPayload,
	partScriptFromRow,
	resolveGoogleSheetsPieceMappings,
	sheetRowMatchesMapping,
	type GoogleSheetsPieceTypeMapping
} from './sheetMapping'
import type { SheetRow } from './types'

type PiecePayload = Record<string, PayloadValue>

function normalizePieceType(pieceType: string): string {
	return pieceType.trim().toLowerCase()
}

function piecesForPart(pieces: Piece[], partId: string): Piece[] {
	return pieces
		.filter((p) => p.partId === partId)
		.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
}

function sortByRank<T extends { rank: number }>(items: T[]): T[] {
	return [...items].sort((a, b) => a.rank - b.rank)
}

function asArray<T>(value: T | T[] | undefined): T[] {
	if (!value) return []
	return Array.isArray(value) ? value : [value]
}

async function shiftPartRanksFrom(
	segmentId: string,
	fromRank: number,
	delta: number
): Promise<void> {
	if (delta === 0) return
	const { result } = await partMutations.read({ segmentId })
	if (!result || !Array.isArray(result)) return

	const toShift = result.filter((p) => p.rank >= fromRank).sort((a, b) => b.rank - a.rank)
	for (const part of toShift) {
		await partMutations.update({
			...part,
			rank: part.rank + delta
		})
	}
}

async function loadRundownPieces(rundownId: string): Promise<{
	parts: Part[]
	pieces: Piece[]
}> {
	const { result: parts, error: partError } = await partMutations.read({ rundownId })
	if (partError) throw partError

	const { result: pieces, error: pieceError } = await pieceMutations.read({ rundownId })
	if (pieceError) throw pieceError

	return {
		parts: sortByRank(asArray(parts).filter((p) => !p.float)),
		pieces: asArray(pieces)
	}
}

function headlinePartsOrdered(
	segments: { id: string; rank: number }[],
	parts: Part[],
	pieces: Piece[],
	pieceTypeId: string
): Part[] {
	const segmentRank = new Map(segments.map((s) => [s.id, s.rank]))
	const normalized = normalizePieceType(pieceTypeId)
	return parts
		.filter((part) =>
			piecesForPart(pieces, part.id).some(
				(piece) => normalizePieceType(piece.pieceType) === normalized
			)
		)
		.sort((a, b) => {
			const segDiff = (segmentRank.get(a.segmentId) ?? 0) - (segmentRank.get(b.segmentId) ?? 0)
			if (segDiff !== 0) return segDiff
			return a.rank - b.rank
		})
}

function filterSheetRowsForMapping(
	rows: SheetRow[],
	mapping: GoogleSheetsPieceTypeMapping
): SheetRow[] {
	const matched = rows.filter((row) => sheetRowMatchesMapping(row, mapping))
	const max = mapping.maxRows ?? matched.length
	return matched.slice(0, max)
}

export interface PullFromGoogleSheetsResult {
	updatedParts: number
	updatedPieces: number
	createdParts: number
	createdPieces: number
}

async function applyMappingPull(
	rundownId: string,
	rows: SheetRow[],
	mapping: GoogleSheetsPieceTypeMapping,
	parts: Part[],
	pieces: Piece[],
	segments: { id: string; rank: number }[]
): Promise<Pick<PullFromGoogleSheetsResult, 'updatedParts' | 'updatedPieces' | 'createdParts' | 'createdPieces'>> {
	const sheetRows = filterSheetRowsForMapping(rows, mapping)
	if (sheetRows.length === 0) {
		return { updatedParts: 0, updatedPieces: 0, createdParts: 0, createdPieces: 0 }
	}

	const targetParts = headlinePartsOrdered(segments, parts, pieces, mapping.pieceTypeId)
	let updatedParts = 0
	let updatedPieces = 0
	let createdParts = 0
	let createdPieces = 0

	const updateCount = Math.min(sheetRows.length, targetParts.length)
	for (let i = 0; i < updateCount; i++) {
		const part = targetParts[i]
		const row = sheetRows[i]
		const headPiece = piecesForPart(pieces, part.id).find(
			(p) => normalizePieceType(p.pieceType) === normalizePieceType(mapping.pieceTypeId)
		)
		if (!headPiece) continue

		const payload: PiecePayload = { ...((headPiece.payload ?? {}) as PiecePayload) }
		applyFieldMappingsToPayload(payload, mapping.fields, row)
		const { error: pieceError } = await pieceMutations.update({
			...headPiece,
			payload,
			name:
				(typeof payload.title === 'string' && payload.title.trim()) ||
				headPiece.name
		})
		if (!pieceError) updatedPieces++

		if (mapping.fields.some((f) => f.sourceField === 'part.script')) {
			const script = partScriptFromRow(mapping.fields, row) ?? ''
			const { error: partError } = await partMutations.update({
				...part,
				script
			})
			if (!partError) updatedParts++
		}
	}

	const extraRows = sheetRows.slice(targetParts.length)
	if (extraRows.length === 0) {
		return { updatedParts, updatedPieces, createdParts, createdPieces }
	}

	const anchorPart = targetParts[0]
	const segmentId = anchorPart?.segmentId ?? segments.sort((a, b) => a.rank - b.rank)[0]?.id
	if (!segmentId) {
		return { updatedParts, updatedPieces, createdParts, createdPieces }
	}

	const segmentParts = sortByRank(parts.filter((p) => p.segmentId === segmentId))
	const insertRank =
		anchorPart !== undefined
			? anchorPart.rank + 1
			: (segmentParts[segmentParts.length - 1]?.rank ?? -1) + 1

	await shiftPartRanksFrom(segmentId, insertRank, extraRows.length)
	for (const part of parts) {
		if (part.segmentId === segmentId && part.rank >= insertRank) {
			part.rank += extraRows.length
		}
	}

	for (let i = 0; i < extraRows.length; i++) {
		const row = extraRows[i]
		const rank = insertRank + i
		const { result: newPart, error: createPartError } = await partMutations.create({
			rundownId,
			segmentId,
			playlistId: anchorPart?.playlistId ?? null,
			name: `Head ${targetParts.length + i + 1}`,
			rank,
			partType: anchorPart?.partType ?? 'VO',
			float: false,
			payload: anchorPart?.payload ?? {},
			script: partScriptFromRow(mapping.fields, row) ?? ''
		})
		if (createPartError || !newPart) continue
		createdParts++
		parts.push(newPart)

		const payload: PiecePayload = {}
		applyFieldMappingsToPayload(payload, mapping.fields, row)
		const { result: newPiece, error: createPieceError } = await pieceMutations.create({
			rundownId,
			segmentId,
			partId: newPart.id,
			playlistId: newPart.playlistId,
			name: (typeof payload.title === 'string' && payload.title) || newPart.name,
			pieceType: mapping.pieceTypeId,
			payload
		})
		if (!createPieceError && newPiece) {
			createdPieces++
			pieces.push(newPiece)
		}
	}

	return { updatedParts, updatedPieces, createdParts, createdPieces }
}

/**
 * Pull configured piece-type columns from Google Sheet rows into the rundown.
 */
export async function pullRundownFromGoogleSheets(
	rundownId: string,
	rows: SheetRow[],
	settings?: ApplicationSettings
): Promise<PullFromGoogleSheetsResult> {
	const mappings = resolveGoogleSheetsPieceMappings(settings?.googleSheetsPieceMappings)
	const { result: segments, error: segmentError } = await segmentMutations.read({ rundownId })
	if (segmentError) throw segmentError

	const segmentList = sortByRank(asArray(segments).filter((s) => !s.float))
	const { parts, pieces } = await loadRundownPieces(rundownId)

	let updatedParts = 0
	let updatedPieces = 0
	let createdParts = 0
	let createdPieces = 0

	for (const mapping of mappings) {
		const result = await applyMappingPull(
			rundownId,
			rows,
			mapping,
			parts,
			pieces,
			segmentList
		)
		updatedParts += result.updatedParts
		updatedPieces += result.updatedPieces
		createdParts += result.createdParts
		createdPieces += result.createdPieces
	}

	return { updatedParts, updatedPieces, createdParts, createdPieces }
}
