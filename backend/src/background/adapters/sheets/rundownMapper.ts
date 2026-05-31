import { mutations as partMutations } from '../../api/parts'
import { mutations as pieceMutations } from '../../api/pieces'
import { mutations as rundownMutations } from '../../api/rundowns'
import { mutations as segmentMutations } from '../../api/segments'
import type { Part, Piece, Rundown, Segment } from '../../interfaces'
import {
	mappingForPieceType,
	payloadToSheetRowFields,
	resolveGoogleSheetsPieceMappings
} from './sheetMapping'
import { BLOCK, PLAYOUT, TRANSITION } from './types'
import type { SheetRow } from './types'
import type { GoogleSheetsPieceTypeMapping } from './sheetMapping'

const HEADLINE_TRANSITIONS = [
	TRANSITION.HEADLINE_1,
	TRANSITION.HEADLINE_2,
	TRANSITION.HEADLINE_3
] as const

const HEADLINE_PLAYOUTS = [PLAYOUT.HEADLINE_1, PLAYOUT.HEADLINE_2, PLAYOUT.HEADLINE_3] as const

type PiecePayload = Record<string, unknown>

function emptyRow(partial: Partial<SheetRow> = {}): SheetRow {
	return {
		block: '',
		longText1: '',
		headline1: '',
		headline2: '',
		transition: '',
		playout: '',
		...partial
	}
}

function normalizePieceType(pieceType: string): string {
	return pieceType.trim().toLowerCase()
}

function partScript(part: Part): string {
	const fromPart = typeof part.script === 'string' ? part.script : ''
	if (fromPart.trim()) return fromPart
	const payload = part.payload as PiecePayload | undefined
	const fromPayload = payload?.script
	return typeof fromPayload === 'string' ? fromPayload : ''
}

function payloadString(payload: PiecePayload | undefined, ...keys: string[]): string {
	if (!payload) return ''
	for (const key of keys) {
		const value = payload[key]
		if (typeof value === 'string' && value.trim()) return value.trim()
	}
	return ''
}

function playoutSlug(segmentName: string): string {
	const normalized = segmentName
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
	return normalized ? `ILU ${normalized}` : 'ILU'
}

function isClusterPiece(piece: Piece): boolean {
	const haystack = `${piece.name} ${JSON.stringify(piece.payload ?? {})}`.toUpperCase()
	return haystack.includes('CLUSTER')
}

function synPlayoutPrefix(piece: Piece): string {
	return isClusterPiece(piece) ? 'SYN CLUSTER' : 'SYN'
}

function synPlayout(piece: Piece, payload: PiecePayload): string {
	const fileName = payloadString(payload, 'fileName')
	if (fileName) return fileName
	const speaker = payloadString(payload, 'name') || piece.name
	const token = speaker.trim().split(/\s+/)[0]?.toUpperCase() ?? ''
	return token ? `${synPlayoutPrefix(piece)} ${token}` : synPlayoutPrefix(piece)
}

function isIntroSegment(segment: Segment): boolean {
	if (segment.segmentType?.trim().toLowerCase() === 'intro') return true
	return /^intro$/i.test(segment.name.trim())
}

function isOneSentenceSegment(segment: Segment): boolean {
	const normalized = segment.name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
	return /spravy jednou vetou/i.test(normalized) || /správy jednou vetou/i.test(segment.name)
}

function isSportSegment(segment: Segment): boolean {
	return /šport|sport/i.test(segment.name)
}

function isWeatherSegment(segment: Segment): boolean {
	return /počasie|pocasie|weather/i.test(segment.name)
}

function isRecommendationSegment(segment: Segment): boolean {
	return /záver|zaver|outro/i.test(segment.name)
}

function sortByRank<T extends { rank: number }>(items: T[]): T[] {
	return [...items].sort((a, b) => a.rank - b.rank)
}

function asArray<T>(value: T | T[] | undefined): T[] {
	if (!value) return []
	return Array.isArray(value) ? value : [value]
}

async function loadRundownTree(rundownId: string): Promise<{
	rundown: Rundown
	segments: Segment[]
	parts: Part[]
	pieces: Piece[]
}> {
	const { result: rundown, error: rundownError } = await rundownMutations.readOne(rundownId)
	if (rundownError || !rundown) {
		throw new Error(rundownError?.message ?? `Rundown not found: ${rundownId}`)
	}

	const { result: segments, error: segmentError } = await segmentMutations.read({ rundownId })
	if (segmentError) throw segmentError

	const { result: parts, error: partError } = await partMutations.read({ rundownId })
	if (partError) throw partError

	const { result: pieces, error: pieceError } = await pieceMutations.read({ rundownId })
	if (pieceError) throw pieceError

	return {
		rundown,
		segments: sortByRank(asArray(segments).filter((s) => !s.float)),
		parts: sortByRank(asArray(parts).filter((p) => !p.float)),
		pieces: asArray(pieces)
	}
}

function piecesForPart(pieces: Piece[], partId: string): Piece[] {
	return pieces
		.filter((p) => p.partId === partId)
		.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
}

function partsForSegment(parts: Part[], segmentId: string): Part[] {
	return sortByRank(parts.filter((p) => p.segmentId === segmentId))
}

function presenterName(rundown: Rundown): string {
	const payload = rundown.payload as PiecePayload | undefined
	return payloadString(payload, 'presenterName')
}

function mapHeadlineRows(
	segments: Segment[],
	parts: Part[],
	pieces: Piece[],
	headMapping: GoogleSheetsPieceTypeMapping | undefined
): SheetRow[] {
	const segmentRank = new Map(segments.map((s) => [s.id, s.rank]))
	const pieceTypeId = headMapping?.pieceTypeId ?? 'head'
	const maxRows = headMapping?.maxRows ?? 3
	const headlineParts = parts
		.filter((part) =>
			piecesForPart(pieces, part.id).some(
				(piece) => normalizePieceType(piece.pieceType) === normalizePieceType(pieceTypeId)
			)
		)
		.sort((a, b) => {
			const segDiff = (segmentRank.get(a.segmentId) ?? 0) - (segmentRank.get(b.segmentId) ?? 0)
			if (segDiff !== 0) return segDiff
			return a.rank - b.rank
		})

	const fields = headMapping?.fields ?? []
	const rows: SheetRow[] = []
	for (const part of headlineParts.slice(0, maxRows)) {
		const headPiece = piecesForPart(pieces, part.id).find(
			(piece) => normalizePieceType(piece.pieceType) === normalizePieceType(pieceTypeId)
		)
		if (!headPiece) continue

		const payload = (headPiece.payload ?? {}) as PiecePayload
		const index = rows.length
		const mapped = payloadToSheetRowFields(payload, fields, partScript(part))

		rows.push(
			emptyRow({
				...mapped,
				headline1:
					mapped.headline1 ||
					payloadString(payload, 'title', 'text') ||
					part.name,
				headline2: mapped.headline2 || payloadString(payload, 'subtitle'),
				longText1: mapped.longText1 || partScript(part),
				transition: HEADLINE_TRANSITIONS[index] ?? TRANSITION.HEADLINE_3,
				playout: HEADLINE_PLAYOUTS[index] ?? PLAYOUT.HEADLINE_3
			})
		)
	}

	return rows
}

function mapIntroRow(rundown: Rundown, segments: Segment[], parts: Part[]): SheetRow {
	let headline1 = presenterName(rundown)

	const titlesPart = parts.find((part) => part.partType?.trim().toLowerCase() === 'titles')
	if (!headline1 && titlesPart) {
		headline1 = titlesPart.name
	}

	if (!headline1 && segments.length > 0) {
		const firstSegmentParts = partsForSegment(parts, segments[0].id)
		const camPart = firstSegmentParts.find(
			(part) => part.partType?.trim().toLowerCase() === 'cam' || part.partType?.trim().toLowerCase() === 'camera'
		)
		if (camPart) headline1 = camPart.name
	}

	return emptyRow({
		block: BLOCK.INTRO,
		headline1,
		transition: TRANSITION.INTRO,
		playout: PLAYOUT.INTRO
	})
}

function mapVideoRow(segment: Segment, part: Part, piece: Piece): SheetRow {
	const payload = (piece.payload ?? {}) as PiecePayload
	const playoutFromPayload = payloadString(payload, 'fileName')
	const playout =
		playoutFromPayload ||
		(piece.name.trim().toUpperCase().startsWith('ILU') ? piece.name.trim() : playoutSlug(segment.name))

	return emptyRow({
		block: segment.name,
		longText1: partScript(part),
		headline1: part.name,
		headline2: '',
		playout
	})
}

function mapRemoteRow(segment: Segment, part: Part, piece: Piece): SheetRow {
	const payload = (piece.payload ?? {}) as PiecePayload
	const longText1 =
		payloadString(payload, 'quote', 'text') || partScript(part)

	return emptyRow({
		block: segment.name,
		longText1,
		headline1: payloadString(payload, 'name') || piece.name,
		headline2: payloadString(payload, 'title', 'role'),
		playout: synPlayout(piece, payload)
	})
}

function applyL3dToRow(row: SheetRow, piece: Piece): void {
	const payload = (piece.payload ?? {}) as PiecePayload
	if (!row.headline1.trim()) {
		row.headline1 = payloadString(payload, 'name', 'text') || piece.name
	}
	if (!row.headline2.trim()) {
		row.headline2 = payloadString(payload, 'title', 'role', 'subtitle')
	}
}

function mapPartPiecesToRows(segment: Segment, part: Part, pieces: Piece[]): SheetRow[] {
	const partPieces = piecesForPart(pieces, part.id)
	const rows: SheetRow[] = []
	let pendingL3d: Piece[] = []

	const applyPendingL3dToRow = (row: SheetRow): void => {
		if (pendingL3d.length === 0) return
		for (const l3d of pendingL3d) {
			if (!row.headline1.trim()) {
				applyL3dToRow(row, l3d)
			}
		}
		pendingL3d = []
	}

	const applyL3dToLastRow = (): void => {
		if (pendingL3d.length === 0 || rows.length === 0) return
		applyPendingL3dToRow(rows[rows.length - 1])
	}

	for (const piece of partPieces) {
		const type = normalizePieceType(piece.pieceType)
		const playoutCue = payloadString((piece.payload ?? {}) as PiecePayload, 'fileName', 'playout') || piece.name

		if (type === 'camera') continue

		if (type === 'l3d') {
			if (rows.length > 0) {
				const last = rows[rows.length - 1]
				if (!last.headline1.trim()) {
					applyL3dToRow(last, piece)
				}
			} else {
				pendingL3d.push(piece)
			}
			continue
		}

		if (type === 'head') {
			applyL3dToLastRow()
			continue
		}

		let row: SheetRow | null = null

		if (type === 'video' || playoutCue.trim().toUpperCase().startsWith('ILU')) {
			row = mapVideoRow(segment, part, piece)
		} else if (type === 'remote') {
			row = mapRemoteRow(segment, part, piece)
		}

		if (row) {
			rows.push(row)
			applyPendingL3dToRow(row)
		}
	}

	applyL3dToLastRow()
	return rows
}

function mapOneSentenceSegment(segment: Segment, parts: Part[]): SheetRow[] {
	const segmentParts = partsForSegment(parts, segment.id)
	return segmentParts.map((part, index) =>
		emptyRow({
			block: BLOCK.ONE_SENTENCE,
			longText1: partScript(part),
			headline1: part.name,
			transition: index === 0 ? TRANSITION.SPRAVY_JV : TRANSITION.SPRAVY_JV_NEXT
		})
	)
}

function mapSportSegment(segment: Segment, parts: Part[]): SheetRow[] {
	const segmentParts = partsForSegment(parts, segment.id).slice(0, 2)
	if (segmentParts.length === 0) return []

	const rows: SheetRow[] = [
		emptyRow({
			block: BLOCK.SPORT,
			longText1: partScript(segmentParts[0]),
			headline1: segmentParts[0].name,
			transition: TRANSITION.SPORT
		})
	]

	if (segmentParts[1]) {
		rows.push(
			emptyRow({
				block: BLOCK.SPORT,
				longText1: partScript(segmentParts[1]),
				headline1: segmentParts[1].name,
				transition: TRANSITION.SPORT_NEXT
			})
		)
	}

	return rows
}

function mapWeatherSegment(segment: Segment, parts: Part[]): SheetRow[] {
	const segmentParts = partsForSegment(parts, segment.id)
	const text = segmentParts.map((part) => partScript(part).trim()).filter(Boolean).join('\n\n')
	if (!text) return []

	return [
		emptyRow({
			block: BLOCK.WEATHER,
			longText1: text,
			transition: TRANSITION.POCASIE,
			playout: PLAYOUT.POCASIE
		})
	]
}

function mapRecommendationSegment(segment: Segment, parts: Part[]): SheetRow[] {
	const segmentParts = partsForSegment(parts, segment.id)
	const text = segmentParts.map((part) => partScript(part).trim()).filter(Boolean).join('\n\n')
	const rows: SheetRow[] = []

	if (text) {
		rows.push(
			emptyRow({
				block: BLOCK.RECOMMENDATION,
				longText1: text,
				transition: TRANSITION.ZAVER
			})
		)
	}

	rows.push(
		emptyRow({
			transition: TRANSITION.OUTRO,
			playout: TRANSITION.OUTRO
		})
	)

	return rows
}

function mapIntroSegmentRow(rundown: Rundown, segment: Segment): SheetRow {
	return emptyRow({
		block: BLOCK.INTRO,
		headline1: presenterName(rundown),
		transition: TRANSITION.INTRO,
		playout: PLAYOUT.INTRO
	})
}

function mapGenericSegment(
	rundown: Rundown,
	segment: Segment,
	parts: Part[],
	pieces: Piece[]
): SheetRow[] {
	if (isIntroSegment(segment)) {
		return [mapIntroSegmentRow(rundown, segment)]
	}
	if (isOneSentenceSegment(segment)) {
		return mapOneSentenceSegment(segment, parts)
	}
	if (isSportSegment(segment)) {
		return mapSportSegment(segment, parts)
	}
	if (isWeatherSegment(segment)) {
		return mapWeatherSegment(segment, parts)
	}
	if (isRecommendationSegment(segment)) {
		return mapRecommendationSegment(segment, parts)
	}

	const segmentParts = partsForSegment(parts, segment.id)
	return segmentParts.flatMap((part) => mapPartPiecesToRows(segment, part, pieces))
}

/**
 * Map Rundown Editor segments, parts, and pieces into ordered Google Sheet rows.
 * Show order: headlines → intro → segments (rank) with per-piece rules.
 */
export async function mapRundownToSheetRows(
	rundownId: string,
	pieceMappings = resolveGoogleSheetsPieceMappings(undefined)
): Promise<SheetRow[]> {
	const { rundown, segments, parts, pieces } = await loadRundownTree(rundownId)

	const headMapping = mappingForPieceType('head', pieceMappings)
	const headlineRows = mapHeadlineRows(segments, parts, pieces, headMapping)
	const introRow = mapIntroRow(rundown, segments, parts)

	const bodySegments = segments.filter((segment) => {
		if (isIntroSegment(segment)) return false
		return true
	})

	const bodyRows = bodySegments.flatMap((segment) =>
		mapGenericSegment(rundown, segment, parts, pieces)
	)

	return [...headlineRows, introRow, ...bodyRows]
}
