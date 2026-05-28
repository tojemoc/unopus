import type {
	NrcsHeadline,
	NrcsMainTopic,
	NrcsOneSentenceItem,
	NrcsQuote,
	NrcsRundownInput,
	NrcsSportItem,
	NrcsWeather,
	NrcsRecommendation
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value.trim() : fallback
}

function parseHeadline(raw: unknown): NrcsHeadline | null {
	if (!raw || typeof raw !== 'object') return null
	const obj = raw as Record<string, unknown>
	const title = asString(obj.title)
	if (!title) return null
	return {
		title,
		subtitle: asString(obj.subtitle),
		summary: asString(obj.summary)
	}
}

function parseQuote(raw: unknown): NrcsQuote | null {
	if (!raw || typeof raw !== 'object') return null
	const obj = raw as Record<string, unknown>
	const speaker = asString(obj.speaker)
	const text = asString(obj.text)
	if (!speaker || !text) return null
	return {
		speaker,
		role: asString(obj.role),
		text
	}
}

function parseMainTopic(raw: unknown): NrcsMainTopic | null {
	if (!raw || typeof raw !== 'object') return null
	const obj = raw as Record<string, unknown>
	const slug = asString(obj.slug)
	const title = asString(obj.title)
	if (!slug || !title) return null
	const quotes = Array.isArray(obj.quotes)
		? obj.quotes.map(parseQuote).filter((q): q is NrcsQuote => q !== null)
		: undefined
	return {
		slug,
		title,
		body: asString(obj.body),
		quotes: quotes?.length ? quotes : undefined,
		playoutCue: asString(obj.playoutCue) || undefined
	}
}

function parseOneSentence(raw: unknown): NrcsOneSentenceItem | null {
	if (!raw || typeof raw !== 'object') return null
	const obj = raw as Record<string, unknown>
	const text = asString(obj.text)
	if (!text) return null
	return {
		text,
		title: asString(obj.title)
	}
}

function parseSport(raw: unknown): NrcsSportItem | null {
	if (!raw || typeof raw !== 'object') return null
	const obj = raw as Record<string, unknown>
	const text = asString(obj.text)
	if (!text) return null
	return {
		text,
		title: asString(obj.title)
	}
}

function parseWeather(raw: unknown): NrcsWeather | undefined {
	if (!raw || typeof raw !== 'object') return undefined
	const text = asString((raw as Record<string, unknown>).text)
	return text ? { text } : undefined
}

function parseRecommendation(raw: unknown): NrcsRecommendation | undefined {
	if (!raw || typeof raw !== 'object') return undefined
	const text = asString((raw as Record<string, unknown>).text)
	return text ? { text } : undefined
}

function parseBundledRundownMainTopics(obj: Record<string, unknown>): NrcsMainTopic[] {
	if (!Array.isArray(obj.parts)) return []

	const segmentNameById = new Map<string, string>()
	if (Array.isArray(obj.segments)) {
		for (const rawSegment of obj.segments) {
			if (!isRecord(rawSegment)) continue
			const segmentId = asString(rawSegment.id)
			const name = asString(rawSegment.name)
			if (segmentId && name) {
				segmentNameById.set(segmentId, name)
			}
		}
	}

	const groupedScripts = new Map<string, { title: string; scripts: string[]; rank: number }>()

	for (const rawPart of obj.parts) {
		if (!isRecord(rawPart)) continue

		const scriptDirect = asString(rawPart.script)
		const payload = isRecord(rawPart.payload) ? rawPart.payload : undefined
		const scriptFromPayload = asString(payload?.script)
		const script = scriptDirect || scriptFromPayload
		if (!script) continue

		const segmentId = asString(rawPart.segmentId) || 'ungrouped'
		const segmentTitle = segmentNameById.get(segmentId) || asString(rawPart.name) || 'Story'
		const rankRaw = rawPart.rank
		const partRank = typeof rankRaw === 'number' && Number.isFinite(rankRaw) ? rankRaw : Number.MAX_SAFE_INTEGER

		const existing = groupedScripts.get(segmentId)
		if (!existing) {
			groupedScripts.set(segmentId, { title: segmentTitle, scripts: [script], rank: partRank })
			continue
		}
		existing.scripts.push(script)
		existing.rank = Math.min(existing.rank, partRank)
	}

	return [...groupedScripts.entries()]
		.sort((a, b) => a[1].rank - b[1].rank)
		.map(([segmentId, group], index) => {
			const normalizedTitle = group.title.trim() || `Story ${index + 1}`
			return {
				slug: normalizedTitle || segmentId || `TOPIC_${index + 1}`,
				title: normalizedTitle,
				body: group.scripts.join('\n\n')
			}
		})
}

/** Coerce loosely typed JSON into a normalized NRCS rundown structure. */
export function parseNrcsRundown(input: unknown): NrcsRundownInput {
	if (!input || typeof input !== 'object') {
		return {}
	}
	const obj = input as Record<string, unknown>
	const normalized: NrcsRundownInput = {
		headlines: Array.isArray(obj.headlines)
			? obj.headlines.map(parseHeadline).filter((h): h is NrcsHeadline => h !== null)
			: [],
		presenterName: asString(obj.presenterName) || undefined,
		main_topics: Array.isArray(obj.main_topics)
			? obj.main_topics.map(parseMainTopic).filter((t): t is NrcsMainTopic => t !== null)
			: [],
		one_sentence: Array.isArray(obj.one_sentence)
			? obj.one_sentence.map(parseOneSentence).filter((i): i is NrcsOneSentenceItem => i !== null)
			: [],
		sports: Array.isArray(obj.sports)
			? obj.sports.map(parseSport).filter((s): s is NrcsSportItem => s !== null)
			: [],
		weather: parseWeather(obj.weather),
		recommendation: parseRecommendation(obj.recommendation)
	}

	// Legacy "bundled rundown JSON" exports store story text in part.script/payload.script.
	// When explicit NRCS story structures are missing, derive main topics from those scripts.
	if ((normalized.main_topics?.length ?? 0) === 0) {
		const bundledTopics = parseBundledRundownMainTopics(obj)
		if (bundledTopics.length > 0) {
			normalized.main_topics = bundledTopics
		}
	}

	return normalized
}
