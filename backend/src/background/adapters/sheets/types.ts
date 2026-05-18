/** One logical row in the vMix Google Sheet automation layout (columns C–K). */
export interface SheetRow {
	block: string
	longText1: string
	headline1: string
	headline2: string
	transition: string
	playout: string
	/** Column K (hlasitost); empty when no ILU/SYN playout rule applies. */
	volume?: number | ''
}

export const SHEET_COLUMN = {
	BLOCK: 'C',
	LONG_TEXT_1: 'D',
	HEADLINE_1: 'E',
	HEADLINE_2: 'F',
	TRANSITION: 'I',
	PLAYOUT: 'J'
} as const

/** 0-based column index in a full A–K row (A = 0). */
export const SHEET_COLUMN_INDEX = {
	A: 0,
	B: 1,
	C: 2,
	D: 3,
	E: 4,
	F: 5,
	G: 6,
	H: 7,
	I: 8,
	J: 9,
	K: 10
} as const

export const TRANSITION = {
	BLANK: 'BLANK',
	INTRO: 'Intro',
	HEADLINE_1: 'Headline 1',
	HEADLINE_2: 'Headline 2',
	HEADLINE_3: 'Headline 3',
	DOUBLE_BOX: 'Double Box',
	ILU_TO_SYN: 'ILU TO SYN',
	ILU_TO_SYN_CLUSTER: 'ILU TO SYN CLUSTER',
	SYN_TO_ILU: 'SYN TO ILU',
	SYN_TO_ILU_TEMA: 'SYN TO ILU TEMA',
	ILU_TO_ILU_TEMA: 'ILU TO ILU TEMA',
	SPRAVY_JV: 'Spravy JV',
	SPRAVY_JV_NEXT: 'Spravy JV NEXT',
	SPORT: 'Sport',
	SPORT_NEXT: 'Sport NEXT',
	POCASIE: 'Pocasie',
	ZAVER: 'Zaver',
	OUTRO: 'OUTRO'
} as const

export const BLOCK = {
	INTRO: 'INTRO',
	ONE_SENTENCE: 'SPRÁVY JEDNOU VETOU',
	SPORT: 'ŠPORT',
	WEATHER: 'POČASIE',
	RECOMMENDATION: 'ZÁVER + AVIZO'
} as const

export const PLAYOUT = {
	HEADLINE_1: 'HEADLINE1',
	HEADLINE_2: 'HEADLINE2',
	HEADLINE_3: 'HEADLINE3',
	INTRO: 'Intro',
	POCASIE: 'POCASIE'
} as const
