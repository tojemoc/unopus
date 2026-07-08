import type { Part, Piece, Rundown, Segment, SerializedRundown } from '~backend/background/interfaces'

type RowKind = 'piece' | 'part' | 'segment'

type CsvRow = Record<string, string>

const RUNDOWN_FIELDS = [
	'id',
	'playlistId',
	'name',
	'sync',
	'isTemplate',
	'expectedStartTime',
	'expectedEndTime'
] as const satisfies readonly (keyof Rundown)[]

const SEGMENT_FIELDS = [
	'id',
	'playlistId',
	'rundownId',
	'name',
	'rank',
	'float',
	'isTemplate',
	'segmentType'
] as const satisfies readonly (keyof Segment)[]

const PART_FIELDS = [
	'id',
	'playlistId',
	'rundownId',
	'segmentId',
	'name',
	'rank',
	'float',
	'script',
	'duration',
	'partType'
] as const satisfies readonly (keyof Part)[]

const PIECE_FIELDS = [
	'id',
	'playlistId',
	'rundownId',
	'segmentId',
	'partId',
	'name',
	'start',
	'duration',
	'pieceType'
] as const satisfies readonly (keyof Piece)[]

function formatCellValue(value: unknown): string {
	if (value === undefined || value === null) return ''
	if (typeof value === 'boolean') return value ? 'true' : 'false'
	if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
	return String(value)
}

function escapeCsvCell(value: string): string {
	let escaped = value
	if (/^[=+\-@]/.test(escaped)) {
		escaped = `'${escaped}`
	}
	if (/[",\r\n]/.test(escaped)) {
		return `"${escaped.replace(/"/g, '""')}"`
	}
	return escaped
}

function collectPayloadColumns(
	entities: Array<{ payload?: Record<string, unknown> }>,
	prefix: 'rundown' | 'segment' | 'part' | 'piece'
): string[] {
	const keys = new Set<string>()
	for (const entity of entities) {
		if (!entity.payload) continue
		for (const key of Object.keys(entity.payload)) {
			keys.add(`${prefix}.payload.${key}`)
		}
	}
	return [...keys].sort()
}

function setEntityFields<T extends object>(
	row: CsvRow,
	prefix: 'rundown' | 'segment' | 'part' | 'piece',
	entity: T | undefined,
	fields: readonly string[]
): void {
	for (const field of fields) {
		row[`${prefix}.${field}`] = formatCellValue(
			entity ? (entity as Record<string, unknown>)[field] : undefined
		)
	}
}

function setPayloadFields(
	row: CsvRow,
	prefix: 'rundown' | 'segment' | 'part' | 'piece',
	entity: { payload?: Record<string, unknown> } | undefined,
	payloadColumns: string[]
): void {
	for (const column of payloadColumns) {
		const key = column.slice(`${prefix}.payload.`.length)
		row[column] = formatCellValue(entity?.payload?.[key])
	}
}

function buildBaseRow(
	kind: RowKind,
	rundown: Rundown,
	segment: Segment | undefined,
	part: Part | undefined,
	piece: Piece | undefined,
	payloadColumns: {
		rundown: string[]
		segment: string[]
		part: string[]
		piece: string[]
	}
): CsvRow {
	const row: CsvRow = { row_kind: kind }

	setEntityFields(row, 'rundown', rundown, RUNDOWN_FIELDS)
	setPayloadFields(row, 'rundown', rundown, payloadColumns.rundown)

	setEntityFields(row, 'segment', segment, SEGMENT_FIELDS)
	setPayloadFields(row, 'segment', segment, payloadColumns.segment)

	setEntityFields(row, 'part', part, PART_FIELDS)
	setPayloadFields(row, 'part', part, payloadColumns.part)

	setEntityFields(row, 'piece', piece, PIECE_FIELDS)
	setPayloadFields(row, 'piece', piece, payloadColumns.piece)

	return row
}

function sortByRank<T extends { rank?: number; name: string }>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		const rankDiff = (a.rank ?? 0) - (b.rank ?? 0)
		return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name)
	})
}

function sortPieces(pieces: Piece[]): Piece[] {
	return [...pieces].sort((a, b) => {
		const startDiff = (a.start ?? 0) - (b.start ?? 0)
		return startDiff !== 0 ? startDiff : a.id.localeCompare(b.id)
	})
}

export function serializedRundownToCsvRows(data: SerializedRundown): CsvRow[] {
	const { rundown, segments, parts, pieces } = data

	const payloadColumns = {
		rundown: collectPayloadColumns([rundown], 'rundown'),
		segment: collectPayloadColumns(segments, 'segment'),
		part: collectPayloadColumns(parts, 'part'),
		piece: collectPayloadColumns(pieces, 'piece')
	}

	const rows: CsvRow[] = []
	const sortedSegments = sortByRank(segments)

	for (const segment of sortedSegments) {
		const segmentParts = sortByRank(parts.filter((part) => part.segmentId === segment.id))

		if (segmentParts.length === 0) {
			rows.push(buildBaseRow('segment', rundown, segment, undefined, undefined, payloadColumns))
			continue
		}

		for (const part of segmentParts) {
			const partPieces = sortPieces(pieces.filter((piece) => piece.partId === part.id))

			if (partPieces.length === 0) {
				rows.push(buildBaseRow('part', rundown, segment, part, undefined, payloadColumns))
				continue
			}

			for (const piece of partPieces) {
				rows.push(buildBaseRow('piece', rundown, segment, part, piece, payloadColumns))
			}
		}
	}

	if (sortedSegments.length === 0) {
		rows.push(buildBaseRow('segment', rundown, undefined, undefined, undefined, payloadColumns))
	}

	return rows
}

function buildHeader(rows: CsvRow[]): string[] {
	const columns = new Set<string>(['row_kind'])
	for (const row of rows) {
		for (const key of Object.keys(row)) {
			columns.add(key)
		}
	}

	return [...columns].sort((a, b) => {
		if (a === 'row_kind') return -1
		if (b === 'row_kind') return 1
		return a.localeCompare(b)
	})
}

export function serializedRundownToCsv(data: SerializedRundown): string {
	const rows = serializedRundownToCsvRows(data)
	const header = buildHeader(rows)

	const lines = [
		header.map(escapeCsvCell).join(','),
		...rows.map((row) => header.map((column) => escapeCsvCell(row[column] ?? '')).join(','))
	]

	return lines.join('\r\n') + '\r\n'
}

export function sanitizeRundownFilename(name: string): string {
	const sanitized = name
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')

	return sanitized || 'rundown'
}
