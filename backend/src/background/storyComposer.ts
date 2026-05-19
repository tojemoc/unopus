import { v4 as uuid } from 'uuid'
import { mutations as partMutations } from './api/parts'
import { mutations as pieceMutations } from './api/pieces'
import { mutations as segmentMutations } from './api/segments'
import { mutations as rundownMutations, sendRundownDiffToCore } from './api/rundowns'
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

function clampInsertRank(requested: number | undefined, partCount: number): number {
	if (requested === undefined) {
		return partCount
	}
	if (typeof requested !== 'number' || !Number.isFinite(requested)) {
		return partCount
	}
	return Math.max(0, Math.min(partCount, Math.floor(requested)))
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

async function pickTemplateSourceSegmentId(templateRundownId: string): Promise<string | undefined> {
	const { result: segments } = await segmentMutations.read({ rundownId: templateRundownId })
	if (!segments || !Array.isArray(segments) || segments.length === 0) {
		return undefined
	}
	const sorted = [...segments].sort((a, b) => a.rank - b.rank)
	let best = sorted[0]
	let bestCount = 0
	for (const segment of sorted) {
		const { result: parts, error } = await partMutations.read({ segmentId: segment.id })
		if (error) {
			throw error
		}
		const count = Array.isArray(parts) ? parts.length : parts ? 1 : 0
		if (count > bestCount) {
			best = segment
			bestCount = count
		}
	}
	return best.id
}

export async function quickAddStoryFromRundownTemplate(
	targetSegmentId: string,
	request: QuickAddStoryRequest
): Promise<{ result?: QuickAddStoryResult; error?: Error }> {
	const templateRundownId = String(request.templateRundownId ?? '').trim()
	if (!templateRundownId) {
		return { error: new Error('templateRundownId is required') }
	}

	const { result: templateRundown, error: rundownError } =
		await rundownMutations.readOne(templateRundownId)
	if (rundownError || !templateRundown) {
		return { error: rundownError ?? new Error('Template rundown not found') }
	}
	if (!templateRundown.isTemplate) {
		return { error: new Error('Selected rundown is not marked as a template') }
	}

	let sourceSegmentId: string | undefined
	try {
		sourceSegmentId = await pickTemplateSourceSegmentId(templateRundownId)
	} catch (err) {
		return { error: err instanceof Error ? err : new Error(String(err)) }
	}
	if (!sourceSegmentId) {
		return { error: new Error('Template rundown has no segments to copy from') }
	}

	const { result: targetSegment, error: segmentError } =
		await segmentMutations.readOne(targetSegmentId)
	if (segmentError || !targetSegment) {
		return { error: segmentError ?? new Error('Segment not found') }
	}

	const { result: sourceParts, error: sourcePartsError } = await partMutations.read({
		segmentId: sourceSegmentId
	})
	if (sourcePartsError) {
		return { error: sourcePartsError }
	}
	const sourcePartList = Array.isArray(sourceParts) ? sourceParts : sourceParts ? [sourceParts] : []
	if (sourcePartList.length === 0) {
		return { error: new Error('Template segment has no parts') }
	}

	const { result: existingParts, error: existingPartsError } = await partMutations.read({
		segmentId: targetSegmentId
	})
	if (existingPartsError) {
		return { error: existingPartsError }
	}
	const partCount = Array.isArray(existingParts) ? existingParts.length : 0
	const startRank = clampInsertRank(request.rank, partCount)

	const createdParts: Part[] = []
	const createdPieces: Piece[] = []

	db.exec('BEGIN')
	try {
		await shiftPartRanksFrom(targetSegmentId, startRank, sourcePartList.length)

		const orderedSourceParts = [...sourcePartList].sort((a, b) => a.rank - b.rank)
		for (let i = 0; i < orderedSourceParts.length; i++) {
			const sourcePart = orderedSourceParts[i]
			const { result: copyResult, error: copyError } = await partMutations.createPartCopy({
				id: sourcePart.id,
				segmentId: targetSegmentId,
				rundownId: targetSegment.rundownId,
				preserveName: true
			})
			if (copyError || !copyResult) {
				throw copyError ?? new Error('Failed to copy part from template')
			}
			const part = await partMutations.update({
				...copyResult.part,
				rank: startRank + i
			})
			if (part.error || !part.result) {
				throw part.error ?? new Error('Failed to position copied part')
			}
			createdParts.push(part.result)
			createdPieces.push(...copyResult.pieces)
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

export async function quickAddStory(
	segmentId: string,
	request: QuickAddStoryRequest
): Promise<{ result?: QuickAddStoryResult; error?: Error }> {
	const templateRundownId = String(request.templateRundownId ?? '').trim()
	if (templateRundownId) {
		return quickAddStoryFromRundownTemplate(segmentId, request)
	}
	const storyTemplateId = String(request.storyTemplateId ?? '').trim()
	if (!storyTemplateId) {
		return { error: new Error('templateRundownId or storyTemplateId is required') }
	}
	return quickAddStoryFromTemplate(segmentId, { ...request, storyTemplateId })
}

export async function quickAddStoryFromTemplate(
	segmentId: string,
	request: QuickAddStoryRequest & { storyTemplateId: string }
): Promise<{ result?: QuickAddStoryResult; error?: Error }> {
	const template = getStoryTemplateById(request.storyTemplateId)
	if (!template) {
		return { error: new Error('Story template not found') }
	}

	const { result: segment, error: segmentError } = await segmentMutations.readOne(segmentId)
	if (segmentError || !segment) {
		return { error: segmentError ?? new Error('Segment not found') }
	}

	const { result: existingParts, error: existingPartsError } = await partMutations.read({
		segmentId
	})
	if (existingPartsError) {
		return { error: existingPartsError }
	}
	const partCount = Array.isArray(existingParts) ? existingParts.length : 0
	const startRank = clampInsertRank(request.rank, partCount)
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

export function importStoryTemplates(
	templates: Array<Pick<StoryTemplate, 'name' | 'pattern'>>
): StoryTemplate[] {
	const created: StoryTemplate[] = []
	for (const template of templates) {
		const name = template.name?.trim()
		if (!name || !Array.isArray(template.pattern) || template.pattern.length === 0) {
			continue
		}
		const pattern = template.pattern
			.map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
			.filter((entry) => entry.length > 0)
		if (pattern.length === 0) {
			continue
		}
		created.push(createStoryTemplate({ name, pattern }))
	}
	return created
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
		expectedStartTime = scheduled.getTime()
		if (request.scheduleDateKey) {
			dateLabel = request.scheduleDateKey
		} else {
			dateLabel = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, '0')}-${String(scheduled.getDate()).padStart(2, '0')}`
		}
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

	const shouldSync = sourceRundown.sync === true

	const { result: updatedRundown, error: updateError } = await rundownMutations.update({
		...copyResult.rundown,
		name: dateLabel ? `${sourceRundown.name} ${dateLabel}` : copyResult.rundown.name,
		...(expectedStartTime !== undefined ? { expectedStartTime } : {}),
		isTemplate: false,
		sync: false,
		sourceTemplateId: sourceRundown.id,
		sourceTemplateRevision:
			request.sourceTemplateRevision ?? sourceRundown.templateRevision ?? 0,
		scheduleDateKey: request.scheduleDateKey ?? dateLabel,
		modifiedAfterGeneration: false,
		templateOutdated: false
	})

	if (updateError || !updatedRundown) {
		return { error: updateError ?? new Error('Failed to update generated rundown') }
	}

	let finalRundown = updatedRundown
	if (shouldSync) {
		const { result: syncedRundown, error: syncUpdateError } = await rundownMutations.update({
			...updatedRundown,
			sync: true
		})
		if (syncUpdateError || !syncedRundown) {
			return {
				error: syncUpdateError ?? new Error('Failed to enable sync for generated rundown')
			}
		}
		try {
			await sendRundownDiffToCore(updatedRundown, syncedRundown)
		} catch (error) {
			const coreError = error instanceof Error ? error : new Error(String(error))
			const { result: rolledBack, error: rollbackError } = await rundownMutations.update({
				...syncedRundown,
				sync: false
			})
			if (rollbackError || !rolledBack) {
				const rollbackMessage =
					rollbackError instanceof Error
						? rollbackError.message
						: rollbackError
							? String(rollbackError)
							: 'rollback update returned no rundown'
				return {
					error: new Error(
						`${coreError.message}; failed to roll back sync: ${rollbackMessage}`
					)
				}
			}
			finalRundown = rolledBack
			return { error: coreError }
		}
		finalRundown = syncedRundown
	}

	copyResult.rundown = finalRundown

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
