import { mutations as partMutations } from '../../api/parts'
import { getMutatedPiecesFromPart } from '../../api/pieces'
import type { MutatedPiece, Part } from '../../interfaces'
import type { SheetRow } from './types'

const KEY_SEP = '\u0001'

function rowMatchKey(block: string, headline1: string): string {
	return `${block}${KEY_SEP}${headline1}`
}

function partMatchKey(part: Part): string {
	const payload =
		part.payload && typeof part.payload === 'object'
			? (part.payload as Record<string, unknown>)
			: {}
	const block = String(payload.slug ?? payload.block ?? '')
	return rowMatchKey(block, part.name ?? '')
}

function pickL3dTiming(pieces: MutatedPiece[]): { start: number; duration: number | '' } | null {
	const withStart = pieces.filter(
		(p) => p.objectType === 'l3d' && p.objectTime !== undefined && p.objectTime !== null
	)
	if (withStart.length === 0) return null

	const best = withStart.reduce((a, b) => (a.objectTime! <= b.objectTime! ? a : b))
	return {
		start: best.objectTime!,
		duration: best.duration ?? ''
	}
}

function buildPartLookup(parts: Part[]): Map<string, Part[]> {
	const lookup = new Map<string, Part[]>()
	for (const part of parts) {
		const key = partMatchKey(part)
		const list = lookup.get(key)
		if (list) {
			list.push(part)
		} else {
			lookup.set(key, [part])
		}
	}
	return lookup
}

function takeMatchingPart(lookup: Map<string, Part[]>, key: string): Part | undefined {
	const list = lookup.get(key)
	if (!list || list.length === 0) return undefined
	return list.shift()
}

/** Max parallel getMutatedPiecesFromPart calls per rundown export. */
const ENRICH_CONCURRENCY = 10

async function enrichRowFromPart(row: SheetRow, part: Part): Promise<SheetRow> {
	const timing = pickL3dTiming(await getMutatedPiecesFromPart(part.id))
	if (!timing) return row
	return {
		...row,
		l3dStart: timing.start,
		l3dDuration: timing.duration
	}
}

async function enrichRowJobs(
	rowJobs: Array<{ row: SheetRow; part: Part | undefined }>
): Promise<SheetRow[]> {
	const enriched: SheetRow[] = []
	for (let i = 0; i < rowJobs.length; i += ENRICH_CONCURRENCY) {
		const batch = rowJobs.slice(i, i + ENRICH_CONCURRENCY)
		const batchResults = await Promise.all(
			batch.map(async ({ row, part }) => {
				if (!part) return row
				try {
					return await enrichRowFromPart(row, part)
				} catch {
					return row
				}
			})
		)
		enriched.push(...batchResults)
	}
	return enriched
}

export async function enrichRowsWithPieces(
	rows: SheetRow[],
	rundownId: string
): Promise<SheetRow[]> {
	try {
		const trimmedId = rundownId.trim()
		if (!trimmedId) return rows

		const { result: parts, error } = await partMutations.read({ rundownId: trimmedId })
		if (error || !parts || !Array.isArray(parts)) return rows

		const lookup = buildPartLookup(parts)
		const rowJobs = rows.map((row) => {
			const key = rowMatchKey(row.block, row.headline1)
			const part = takeMatchingPart(lookup, key)
			return { row, part }
		})

		return await enrichRowJobs(rowJobs)
	} catch {
		return rows
	}
}
