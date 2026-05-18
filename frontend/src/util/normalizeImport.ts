import type {
	Part,
	PayloadValue,
	Piece,
	Rundown,
	Segment,
	SerializedRundown
} from '~backend/background/interfaces'

function newId(): string {
	return crypto.randomUUID()
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const n = Number(value)
		if (Number.isFinite(n)) {
			return n
		}
	}
	return undefined
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback
}

/** Legacy Sofie / editor export: part payload carries `type`, `script`, `duration`. */
function convertLegacyPart(part: Record<string, unknown>): Part {
	const payload = isRecord(part.payload) ? { ...part.payload } : {}
	let partType = asString(part.partType)
	let script = part.script as string | undefined
	let duration = asNumber(part.duration)

	if ('type' in payload) {
		const legacyType = asString(payload.type)
		if (legacyType) {
			partType = legacyType
		}
		if (script === undefined && typeof payload.script === 'string') {
			script = payload.script
		}
		const payloadDuration = asNumber(payload.duration)
		if (duration === undefined && payloadDuration !== undefined) {
			duration = payloadDuration
		}
		delete payload.type
		delete payload.script
		delete payload.duration
	}

	return {
		id: asString(part.id) ?? newId(),
		playlistId: part.playlistId === null ? null : (asString(part.playlistId) ?? null),
		rundownId: asString(part.rundownId) ?? '',
		segmentId: asString(part.segmentId) ?? '',
		name: asString(part.name) ?? 'Part',
		rank: asNumber(part.rank) ?? 0,
		float: asBoolean(part.float, false),
		partType: partType ?? 'unknown',
		script,
		duration,
		payload: asPayload(payload)
	}
}

function convertLegacyPiece(piece: Record<string, unknown>): Piece {
	return {
		id: asString(piece.id) ?? newId(),
		playlistId: piece.playlistId === null ? null : (asString(piece.playlistId) ?? null),
		rundownId: asString(piece.rundownId) ?? '',
		segmentId: asString(piece.segmentId) ?? '',
		partId: asString(piece.partId) ?? '',
		name: asString(piece.name) ?? 'Piece',
		pieceType: asString(piece.pieceType) ?? '',
		start: asNumber(piece.start),
		duration: asNumber(piece.duration),
		payload: (isRecord(piece.payload) ? piece.payload : {}) as Record<string, PayloadValue>
	}
}

function asPayload(record: Record<string, unknown>): Record<string, PayloadValue> {
	return record as Record<string, PayloadValue>
}

function storyPatternToSerialized(
	entry: { name: string; pattern: string[]; cues?: string[] },
	isTemplate: boolean
): SerializedRundown {
	const rundownId = newId()
	const segmentId = newId()
	const cues = entry.cues ?? []

	const parts: Part[] = entry.pattern.map((partTypeId, index) => ({
		id: newId(),
		playlistId: null,
		rundownId,
		segmentId,
		name: cues[index]?.trim() || `${partTypeId} ${index + 1}`,
		rank: index,
		float: false,
		partType: partTypeId,
		payload: {}
	}))

	const rundown: Rundown = {
		id: rundownId,
		playlistId: null,
		name: entry.name,
		sync: false,
		isTemplate,
		payload: {}
	}

	const segment: Segment = {
		id: segmentId,
		playlistId: null,
		rundownId,
		name: 'Story pattern',
		rank: 0,
		float: false,
		isTemplate: false,
		segmentType: 'normal',
		payload: {}
	}

	return {
		rundown,
		segments: [segment],
		parts,
		pieces: [],
		isTemplate
	}
}

function tryParseStoryTemplates(data: unknown): SerializedRundown | null {
	if (!isRecord(data)) {
		return null
	}

	const rawList = Array.isArray(data)
		? data
		: Array.isArray(data.templates)
			? data.templates
			: null

	if (!rawList?.length) {
		return null
	}

	const first = rawList[0]
	if (!isRecord(first)) {
		return null
	}

	const name = asString(first.name)
	const patternRaw = first.pattern ?? first.storyPattern
	if (!name || !Array.isArray(patternRaw) || patternRaw.length === 0) {
		return null
	}

	const pattern: string[] = []
	for (const item of patternRaw) {
		const id = asString(item)
		if (!id) {
			return null
		}
		pattern.push(id)
	}

	const cues = Array.isArray(first.cues)
		? first.cues.map((c) => (typeof c === 'string' ? c : ''))
		: undefined

	return storyPatternToSerialized({ name, pattern, cues }, true)
}

function remapSerializedIds(serialized: SerializedRundown): SerializedRundown {
	const idMap = new Map<string, string>()
	const remap = (oldId: string): string => {
		if (!idMap.has(oldId)) {
			idMap.set(oldId, newId())
		}
		return idMap.get(oldId)!
	}

	const rundownId = remap(serialized.rundown.id)

	const rundown: Rundown = {
		...serialized.rundown,
		id: rundownId,
		sync: false,
		isTemplate: serialized.isTemplate ?? serialized.rundown.isTemplate ?? false
	}

	const segments: Segment[] = serialized.segments.map((segment) => ({
		...segment,
		id: remap(segment.id),
		rundownId,
		playlistId: segment.playlistId ?? null,
		float: asBoolean(segment.float, false),
		segmentType: segment.segmentType || 'normal',
		isTemplate: segment.isTemplate ?? false
	}))

	const parts: Part[] = serialized.parts.map((part) => {
		const converted = isRecord(part as unknown as Record<string, unknown>)
			? convertLegacyPart(part as unknown as Record<string, unknown>)
			: part
		const segmentId = converted.segmentId ? remap(converted.segmentId) : segments[0]?.id ?? newId()
		return {
			...converted,
			id: remap(converted.id),
			rundownId,
			segmentId,
			playlistId: converted.playlistId ?? null
		}
	})

	const pieces: Piece[] = serialized.pieces.map((piece) => {
		const converted = isRecord(piece as unknown as Record<string, unknown>)
			? convertLegacyPiece(piece as unknown as Record<string, unknown>)
			: piece
		return {
			...converted,
			id: remap(converted.id),
			rundownId,
			segmentId: converted.segmentId ? remap(converted.segmentId) : segments[0]?.id ?? newId(),
			partId: converted.partId ? remap(converted.partId) : parts[0]?.id ?? newId(),
			playlistId: converted.playlistId ?? null
		}
	})

	return {
		rundown,
		segments,
		parts,
		pieces,
		isTemplate: rundown.isTemplate
	}
}

function parseSerializedRundown(data: unknown, isTemplate: boolean): SerializedRundown | null {
	if (!isRecord(data) || !isRecord(data.rundown)) {
		return null
	}

	const rundownRaw = data.rundown
	const name = asString(rundownRaw.name)
	if (!name) {
		return null
	}

	const rundown: Rundown = {
		id: asString(rundownRaw.id) ?? newId(),
		playlistId: rundownRaw.playlistId === null ? null : (asString(rundownRaw.playlistId) ?? null),
		name,
		sync: false,
		isTemplate,
		expectedStartTime: asNumber(rundownRaw.expectedStartTime),
		expectedEndTime: asNumber(rundownRaw.expectedEndTime),
		payload: isRecord(rundownRaw.payload) ? asPayload(rundownRaw.payload) : {}
	}

	if (!Array.isArray(data.segments) || !Array.isArray(data.parts) || !Array.isArray(data.pieces)) {
		return null
	}

	const segments: Segment[] = data.segments
		.filter(isRecord)
		.map((segment, index) => ({
			id: asString(segment.id) ?? newId(),
			playlistId: segment.playlistId === null ? null : (asString(segment.playlistId) ?? null),
			rundownId: asString(segment.rundownId) ?? rundown.id,
			name: asString(segment.name) ?? `Segment ${index + 1}`,
			rank: asNumber(segment.rank) ?? index,
			float: asBoolean(segment.float, false),
			isTemplate: asBoolean(segment.isTemplate, false),
			segmentType: asString(segment.segmentType) ?? 'normal',
			payload: isRecord(segment.payload) ? asPayload(segment.payload) : {}
		}))

	const parts: Part[] = data.parts.filter(isRecord).map((part, index) => {
		const converted = convertLegacyPart(part)
		return {
			...converted,
			rundownId: converted.rundownId || rundown.id,
			segmentId: converted.segmentId || segments[0]?.id || newId(),
			rank: converted.rank ?? index
		}
	})

	const pieces: Piece[] = data.pieces.filter(isRecord).map((piece) => convertLegacyPiece(piece))

	return remapSerializedIds({
		rundown,
		segments,
		parts,
		pieces,
		isTemplate
	})
}

/**
 * Accepts a full rundown export, legacy Sofie rundown JSON, or story-pattern template JSON.
 */
export function parseImportFile(data: unknown, isTemplate: boolean): SerializedRundown {
	const story = tryParseStoryTemplates(data)
	if (story) {
		return remapSerializedIds({ ...story, isTemplate: true })
	}

	const rundown = parseSerializedRundown(data, isTemplate)
	if (rundown) {
		return rundown
	}

	throw new Error(
		'Unrecognized import format. Use a rundown export (rundown, segments, parts, pieces) or a story pattern file with { "templates": [{ "name", "pattern" }] }.'
	)
}

export function assertIpcSuccess<T extends { id: string }>(value: T | Error): T {
	if (value instanceof Error) {
		throw value
	}
	if (!value || typeof value !== 'object' || !('id' in value)) {
		throw new Error('Unexpected response from server')
	}
	return value
}
