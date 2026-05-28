import type { NrcsMainTopic, NrcsRundownInput } from '../nrcs/types'
import { BLOCK, PLAYOUT, TRANSITION } from './types'
import type { SheetRow } from './types'

const HEADLINE_TRANSITIONS = [
	TRANSITION.HEADLINE_1,
	TRANSITION.HEADLINE_2,
	TRANSITION.HEADLINE_3
] as const

const HEADLINE_PLAYOUTS = [PLAYOUT.HEADLINE_1, PLAYOUT.HEADLINE_2, PLAYOUT.HEADLINE_3] as const

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

function splitBodyParagraphs(body: string): string[] {
	return body
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean)
}

function playoutSlug(slug: string): string {
	const normalized = slug
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
	return normalized ? `ILU ${normalized}` : 'ILU'
}

function synPlayout(speaker: string): string {
	const token = speaker.trim().split(/\s+/)[0]?.toUpperCase() ?? 'SYN'
	return `SYN ${token}`
}

function mapHeadlines(input: NrcsRundownInput): SheetRow[] {
	const headlines = (input.headlines ?? []).slice(0, 3)
	return headlines.map((story, index) =>
		emptyRow({
			longText1: '',
			headline1: story.title,
			headline2: story.subtitle ?? '',
			transition: HEADLINE_TRANSITIONS[index] ?? TRANSITION.HEADLINE_3,
			playout: HEADLINE_PLAYOUTS[index] ?? PLAYOUT.HEADLINE_3
		})
	)
}

function mapIntro(input: NrcsRundownInput): SheetRow {
	return emptyRow({
		block: BLOCK.INTRO,
		headline1: input.presenterName ?? '',
		transition: TRANSITION.INTRO,
		playout: PLAYOUT.INTRO
	})
}

function mapMainTopic(topic: NrcsMainTopic): SheetRow[] {
	const rows: SheetRow[] = []
	const paragraphs = topic.body ? splitBodyParagraphs(topic.body) : []
	const introNarration = paragraphs[0] ?? topic.body ?? ''
	const extraNarration = paragraphs.slice(1)
	const quotes = topic.quotes ?? []
	const hasQuotes = quotes.length > 0
	const introPlayout = topic.playoutCue?.trim() || playoutSlug(topic.slug)

	rows.push(
		emptyRow({
			block: topic.slug,
			longText1: introNarration,
			headline1: topic.title,
			transition: hasQuotes ? TRANSITION.SYN_TO_ILU_TEMA : TRANSITION.DOUBLE_BOX,
			playout: introPlayout
		})
	)

	for (const quote of quotes) {
		rows.push(
			emptyRow({
				block: topic.slug,
				longText1: quote.text,
				headline1: quote.speaker,
				headline2: quote.role ?? '',
				transition: TRANSITION.ILU_TO_SYN,
				playout: synPlayout(quote.speaker)
			})
		)
	}

	for (const narration of extraNarration) {
		rows.push(
			emptyRow({
				block: topic.slug,
				longText1: narration,
				headline1: topic.title,
				transition: TRANSITION.SYN_TO_ILU,
				playout: playoutSlug(topic.slug)
			})
		)
	}

	if (!hasQuotes && extraNarration.length === 0 && introNarration.length > 120) {
		// Single-block topic with body only: add a closing ILU row when body is substantial.
		if (rows.length === 1) {
			rows.push(
				emptyRow({
					block: topic.slug,
					longText1: '',
					headline1: topic.title,
					transition: TRANSITION.ILU_TO_ILU_TEMA,
					playout: playoutSlug(topic.slug)
				})
			)
		}
	}

	return rows
}

function mapMainTopics(input: NrcsRundownInput): SheetRow[] {
	const topics = (input.main_topics ?? []).slice(0, 5)
	return topics.flatMap(mapMainTopic)
}

function mapOneSentence(input: NrcsRundownInput): SheetRow[] {
	const items = (input.one_sentence ?? []).slice(0, 3)
	return items.map((item, index) =>
		emptyRow({
			block: BLOCK.ONE_SENTENCE,
			longText1: item.text,
			headline1: item.title ?? '',
			transition: index === 0 ? TRANSITION.SPRAVY_JV : TRANSITION.SPRAVY_JV_NEXT
		})
	)
}

function mapSports(input: NrcsRundownInput): SheetRow[] {
	const sports = (input.sports ?? []).slice(0, 2)
	if (sports.length === 0) return []

	const rows: SheetRow[] = [
		emptyRow({
			block: BLOCK.SPORT,
			longText1: sports[0].text,
			headline1: sports[0].title ?? '',
			transition: TRANSITION.SPORT
		})
	]

	if (sports[1]) {
		rows.push(
			emptyRow({
				block: BLOCK.SPORT,
				longText1: sports[1].text,
				headline1: sports[1].title ?? '',
				transition: TRANSITION.SPORT_NEXT
			})
		)
	}

	return rows
}

function mapWeather(input: NrcsRundownInput): SheetRow[] {
	const text = input.weather?.text?.trim()
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

function mapRecommendation(input: NrcsRundownInput): SheetRow[] {
	const text = input.recommendation?.text?.trim()
	if (!text) return []
	return [
		emptyRow({
			block: BLOCK.RECOMMENDATION,
			longText1: text,
			transition: TRANSITION.ZAVER
		})
	]
}

function mapOutro(): SheetRow[] {
	return [
		emptyRow({
			transition: TRANSITION.OUTRO,
			playout: TRANSITION.OUTRO
		})
	]
}

/**
 * Map normalized NRCS JSON into ordered Google Sheet rows for vMix automation.
 * Show order: headlines → intro → main topics → one-sentence → sport → weather → promo → outro.
 */
export function mapNrcsToSheetRows(input: NrcsRundownInput): SheetRow[] {
	return [
		...mapHeadlines(input),
		mapIntro(input),
		...mapMainTopics(input),
		...mapOneSentence(input),
		...mapSports(input),
		...mapWeather(input),
		...mapRecommendation(input),
		...mapOutro()
	]
}
