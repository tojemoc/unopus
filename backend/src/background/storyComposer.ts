import { v4 as uuid } from 'uuid'
import { mutations as partMutations } from './api/parts'
import { mutations as pieceMutations } from './api/pieces'
import { mutations as segmentMutations } from './api/segments'
import { mutations as rundownMutations } from './api/rundowns'
import { mutations as typeManifestMutations } from './api/typeManifests'
import { getSocketIO } from './socket'
import { db } from './db'
import type {
	GenerateRundownFromTemplateRequest,
	MutationPartCopyResult,
	MutationRundownCopyResult,
	Part,
	Piece,
	QuickAddStoryRequest,
	QuickAddStoryResult,
	StoryLibraryRecallRequest,
	StoryTemplate,
	TypeManifest
} from './interfaces'
import { TypeManifestEntity } from './interfaces'

/** Default piece type IDs to create for each part type (by manifest id or shortName). */
const PART_TYPE_PIECE_MAP: Record<string, string[]> = {
	Cam: ['camera'],
	CAM: ['camera'],
	VO: ['camera', 'video'],
	SOT: ['remote'],
	Remote: ['remote'],
	Full: ['camera', 'video'],
	PKG: ['camera', 'video', 'remote'],
	GFX: ['l3d'],
	DVE: ['split'],
	Titles: ['head']
}

function normalizePartTypeKey(partTypeId: string): string {
	return partTypeId.trim()
}

export function getDefaultPieceTypesForPart(partTypeId: string): string[] {
	const key = normalizePartTypeKey(partTypeId)
	if (PART_TYPE_PIECE_MAP[key]) {
		return PART_TYPE_PIECE_MAP[key]
	}
	const upper = key.toUpperCase()
	if (PART_TYPE_PIECE_MAP[upper]) {
		return PART_TYPE_PIECE_MAP[upper]
	}
	return ['camera']
}

async function loadPartTypeManifests(): Promise<TypeManifest[]> {
	const { result } = await typeManifestMutations.read({
		entityType: TypeManifestEntity.Part
	})
	return Array.isArray(result) ? result : []
}

function getPartTypeLabel(partTypeId: string, manifests: TypeManifest[]): string {
	const manifest = manifests.find((m) => m.id === partTypeId)
	return manifest?.shortName ?? manifest?.name ?? partTypeId
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

async function createDefaultPiecesForPart(
	part: Part,
	partTypeId: string
): Promise<Piece[]> {
	const pieceTypeIds = getDefaultPieceTypesForPart(partTypeId)
	const created: Piece[] = []

	for (const pieceType of pieceTypeIds) {
		const { result, error } = await pieceMutations.create({
			playlistId: part.playlistId,
			rundownId: part.rundownId,
			segmentId: part.segmentId,
			partId: part.id,
			name: '',
			pieceType,
			payload: {}
		})
		if (error || !result) {
			throw error ?? new Error(`Failed to create piece of type ${pieceType}`)
		}
		created.push(result)
	}

	return created
}

export async function quickAddStoryFromTemplate(
	segmentId: string,
	request: QuickAddStoryRequest
): Promise<{ result?: QuickAddStoryResult; error?: Error }> {
	const template = getStoryTemplateById(request.storyTemplateId)
	if (!template) {
		return { error: new Error('Story template not found') }
	}

	const { result: segment, error: segmentError } = await segmentMutations.readOne(segmentId)
	if (segmentError || !segment) {
		return { error: segmentError ?? new Error('Segment not found') }
	}

	const { result: existingParts } = await partMutations.read({ segmentId })
	const partCount = Array.isArray(existingParts) ? existingParts.length : 0
	const startRank = request.rank ?? partCount
	const patternLength = template.pattern.length

	if (patternLength === 0) {
		return { error: new Error('Story template pattern is empty') }
	}

	const manifests = await loadPartTypeManifests()
	const typeCounters: Record<string, number> = {}
	const createdParts: Part[] = []
	const createdPieces: Piece[] = []

	db.exec('BEGIN')
	try {
		await shiftPartRanksFrom(segmentId, startRank, patternLength)

		for (let i = 0; i < template.pattern.length; i++) {
			const partTypeId = template.pattern[i]
			const label = getPartTypeLabel(partTypeId, manifests)
			typeCounters[label] = (typeCounters[label] ?? 0) + 1
			const partName = `${label} ${typeCounters[label]}`

			const { result: part, error: createError } = await partMutations.create({
				playlistId: segment.playlistId,
				rundownId: segment.rundownId,
				segmentId: segment.id,
				name: partName,
				partType: partTypeId,
				rank: startRank + i,
				float: false,
				payload: {}
			})

			if (createError || !part) {
				throw createError ?? new Error('Failed to create part')
			}

			const pieces = await createDefaultPiecesForPart(part, partTypeId)
			createdParts.push(part)
			createdPieces.push(...pieces)
		}

		db.exec('COMMIT')
	} catch (e) {
		db.exec('ROLLBACK')
		return { error: e instanceof Error ? e : new Error(String(e)) }
	}

	const io = getSocketIO()
	io?.emit('parts:update', { parts: createdParts })
	io?.emit('pieces:update', { pieces: createdPieces })

	return { result: { parts: createdParts, pieces: createdPieces } }
}

export function getStoryTemplateById(id: string): StoryTemplate | undefined {
	const row = db
		.prepare(`SELECT id, name, pattern, createdAt FROM story_templates WHERE id = ?`)
		.get(id) as { id: string; name: string; pattern: string; createdAt: number } | undefined

	if (!row) return undefined

	let pattern: string[]
	try {
		pattern = JSON.parse(row.pattern) as string[]
	} catch {
		pattern = []
	}

	return {
		id: row.id,
		name: row.name,
		pattern,
		createdAt: row.createdAt
	}
}

export function listStoryTemplates(): StoryTemplate[] {
	const rows = db
		.prepare(`SELECT id, name, pattern, createdAt FROM story_templates ORDER BY createdAt DESC`)
		.all() as Array<{ id: string; name: string; pattern: string; createdAt: number }>

	return rows.map((row) => {
		let pattern: string[] = []
		try {
			pattern = JSON.parse(row.pattern) as string[]
		} catch {
			pattern = []
		}
		return {
			id: row.id,
			name: row.name,
			pattern,
			createdAt: row.createdAt
		}
	})
}

export function createStoryTemplate(
	payload: Pick<StoryTemplate, 'name' | 'pattern'>
): StoryTemplate {
	const id = uuid()
	const createdAt = Date.now()
	db.prepare(
		`INSERT INTO story_templates (id, name, pattern, createdAt) VALUES (?, ?, ?, ?)`
	).run(id, payload.name, JSON.stringify(payload.pattern ?? []), createdAt)

	return { id, name: payload.name, pattern: payload.pattern ?? [], createdAt }
}

export function updateStoryTemplate(
	id: string,
	updates: Partial<Pick<StoryTemplate, 'name' | 'pattern'>>
): StoryTemplate | undefined {
	const existing = getStoryTemplateById(id)
	if (!existing) return undefined

	const name = updates.name ?? existing.name
	const pattern = updates.pattern ?? existing.pattern

	db.prepare(`UPDATE story_templates SET name = ?, pattern = ? WHERE id = ?`).run(
		name,
		JSON.stringify(pattern),
		id
	)

	return getStoryTemplateById(id)
}

export function deleteStoryTemplate(id: string): boolean {
	const result = db.prepare(`DELETE FROM story_templates WHERE id = ?`).run(id)
	return result.changes > 0
}

export async function recallStoryToSegment(
	partId: string,
	request: StoryLibraryRecallRequest
): Promise<{ result?: MutationPartCopyResult; error?: Error }> {
	const targetRank = request.targetRank

	const { result: sourcePart, error: sourceError } = await partMutations.readOne(partId)
	if (sourceError || !sourcePart) {
		return { error: sourceError ?? new Error('Source part not found') }
	}

	if (targetRank !== undefined) {
		await shiftPartRanksFrom(request.targetSegmentId, targetRank, 1)
	}

	const { result, error } = await partMutations.createPartCopy({
		id: partId,
		rundownId: sourcePart.rundownId,
		segmentId: request.targetSegmentId,
		preserveName: true
	})

	if (error || !result) {
		if (targetRank !== undefined) {
			await shiftPartRanksFrom(request.targetSegmentId, targetRank, -1)
		}
		return { error: error instanceof Error ? error : new Error(String(error)) }
	}

	if (targetRank !== undefined && result.part.rank !== targetRank) {
		const { result: updated, error: updateError } = await partMutations.update({
			...result.part,
			rank: targetRank
		})
		if (updateError || !updated) {
			return { error: updateError ?? new Error('Failed to set recall rank') }
		}
		result.part = updated
	}

	const io = getSocketIO()
	io?.emit('parts:update', { parts: [result.part] })
	io?.emit('pieces:update', { pieces: result.pieces })
	io?.emit('segments:update', { segments: [] })

	return { result }
}

export async function generateRundownFromTemplate(
	request: GenerateRundownFromTemplateRequest
): Promise<{ result?: MutationRundownCopyResult; error?: Error }> {
	const { result: sourceRundown, error: readError } = await rundownMutations.readOne(
		request.templateRundownId
	)
	if (readError || !sourceRundown) {
		return { error: readError ?? new Error('Template rundown not found') }
	}
	if (!sourceRundown.isTemplate) {
		return { error: new Error('Source rundown is not a template') }
	}

	const scheduled = new Date(request.scheduledDate)
	const scheduledValid = !Number.isNaN(scheduled.getTime())
	let dateLabel: string | undefined
	let expectedStartTime: number | undefined

	if (scheduledValid) {
		const midnight = new Date(scheduled)
		midnight.setHours(0, 0, 0, 0)
		expectedStartTime = midnight.getTime()
		dateLabel = `${midnight.getFullYear()}-${String(midnight.getMonth() + 1).padStart(2, '0')}-${String(midnight.getDate()).padStart(2, '0')}`
	} else {
		console.warn(
			'generateRundownFromTemplate: invalid scheduledDate',
			request.scheduledDate,
			'— using copy name without date suffix'
		)
	}

	const { result: copyResult, error: copyError } = await rundownMutations.createRundownCopy({
		id: request.templateRundownId,
		preserveTemplate: false
	})

	if (copyError || !copyResult) {
		return { error: copyError instanceof Error ? copyError : new Error(String(copyError)) }
	}

	const { result: updatedRundown, error: updateError } = await rundownMutations.update({
		...copyResult.rundown,
		name: dateLabel ? `${sourceRundown.name} ${dateLabel}` : copyResult.rundown.name,
		...(expectedStartTime !== undefined ? { expectedStartTime } : {}),
		isTemplate: false,
		sync: false
	})

	if (updateError || !updatedRundown) {
		return { error: updateError ?? new Error('Failed to update generated rundown') }
	}

	copyResult.rundown = updatedRundown

	const io = getSocketIO()
	io?.emit('segments:update', { segments: copyResult.segments })
	io?.emit('parts:update', { parts: copyResult.parts })
	io?.emit('pieces:update', { pieces: copyResult.pieces })

	return { result: copyResult }
}

export function searchStoryLibrary(
	query: string,
	limit: number,
	offset: number
): import('./interfaces').StoryLibraryEntry[] {
	const trimmed = query.trim()
	const like = trimmed ? `%${trimmed}%` : '%'

	const rows = db
		.prepare(
			`
		SELECT
			p.id AS id,
			json_extract(p.document, '$.name') AS name,
			json_extract(p.document, '$.script') AS script,
			json_extract(p.document, '$.partType') AS partType,
			json_extract(r.document, '$.name') AS rundownName,
			p.rundownId AS rundownId,
			json_extract(s.document, '$.name') AS segmentName,
			p.segmentId AS segmentId,
			json_extract(r.document, '$.expectedStartTime') AS rundownDate,
			COALESCE(e.edited_at, 0) AS editedAt
		FROM parts p
		INNER JOIN segments s ON p.segmentId = s.id
		INNER JOIN rundowns r ON p.rundownId = r.id
		LEFT JOIN entity_edits e ON e.entity_type = 'part' AND e.entity_id = p.id
		WHERE (
			? = ''
			OR json_extract(p.document, '$.name') LIKE ?
			OR json_extract(p.document, '$.script') LIKE ?
			OR CAST(p.document AS TEXT) LIKE ?
		)
		ORDER BY editedAt DESC
		LIMIT ? OFFSET ?
	`
		)
		.all(trimmed, like, like, like, limit, offset) as Array<{
		id: string
		name: string
		script: string | null
		partType: string
		rundownName: string
		rundownId: string
		segmentName: string
		segmentId: string
		rundownDate: number | null
		editedAt: number
	}>

	return rows.map((row) => ({
		id: row.id,
		name: row.name ?? '',
		script: row.script ?? undefined,
		partType: row.partType ?? '',
		rundownName: row.rundownName ?? '',
		rundownId: row.rundownId,
		segmentName: row.segmentName ?? '',
		segmentId: row.segmentId,
		rundownDate: row.rundownDate ?? undefined,
		editedAt: row.editedAt
	}))
}
