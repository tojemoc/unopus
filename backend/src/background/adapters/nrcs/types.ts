/** Normalized NRCS rundown input for the Google Sheets adapter. */
export interface NrcsHeadline {
	title: string
	subtitle?: string
	summary?: string
}

export interface NrcsQuote {
	speaker: string
	role?: string
	text: string
}

export interface NrcsMainTopic {
	slug: string
	title: string
	body?: string
	quotes?: NrcsQuote[]
	/** Optional vMix / ILU playout cue override for the topic intro row. */
	playoutCue?: string
}

export interface NrcsOneSentenceItem {
	title?: string
	text: string
}

export interface NrcsSportItem {
	title?: string
	text: string
}

export interface NrcsWeather {
	text: string
}

export interface NrcsRecommendation {
	text: string
}

export interface NrcsRundownInput {
	headlines?: NrcsHeadline[]
	/** Optional presenter name on the intro row (Headline1). */
	presenterName?: string
	main_topics?: NrcsMainTopic[]
	one_sentence?: NrcsOneSentenceItem[]
	sports?: NrcsSportItem[]
	weather?: NrcsWeather
	recommendation?: NrcsRecommendation
}
