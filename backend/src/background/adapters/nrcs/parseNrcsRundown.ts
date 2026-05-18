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

/** Coerce loosely typed JSON into a normalized NRCS rundown structure. */
export function parseNrcsRundown(input: unknown): NrcsRundownInput {
	if (!input || typeof input !== 'object') {
		return {}
	}
	const obj = input as Record<string, unknown>
	return {
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
}
