import type { GoogleSheetsColumnKey } from './sheetMapping'

/** One column in the vMix / Companion automation sheet (rows A–K). */
export interface VmixSheetColumnSpec {
	/** Spreadsheet column letter. */
	letter: string
	/** Field on SheetRow used for push/pull mappings. */
	key: GoogleSheetsColumnKey | 'volume' | 'preserved'
	/** Header on production-hot sheet (Slovak). */
	productionHeader?: string
	/** Short label for UI. */
	label: string
	/** What operators put here today (docs + Sheets workflow). */
	role: string
	/** Whether piece-type mappings can read/write this column. */
	mappable: boolean
	/** Rundown Editor push touches this column. */
	writtenOnPush: boolean
}

/**
 * Layout of the “production hot” sheet (columns A–K).
 * Matches a completed Friday newscast export: Blok C, LongText1 D, Headline1 E, Headline2 F,
 * READING TOTAL G, Feedback H, Transition I, Playout J, Hlasitost K.
 */
export const VMIX_AUTOMATION_SHEET_COLUMNS: VmixSheetColumnSpec[] = [
	{
		letter: 'A',
		key: 'preserved',
		label: 'Notes',
		role: 'Editor / Gdrive labels (e.g. “Spravy Gdrive”) — not overwritten on push',
		mappable: false,
		writtenOnPush: false
	},
	{
		letter: 'B',
		key: 'preserved',
		label: '—',
		role: 'Spare / helper column — not overwritten on push',
		mappable: false,
		writtenOnPush: false
	},
	{
		letter: 'C',
		key: 'block',
		productionHeader: 'Blok',
		label: 'Block',
		role: 'Story block (Dron v Rumunsku, ŠPORT, INTRO, …)',
		mappable: true,
		writtenOnPush: true
	},
	{
		letter: 'D',
		key: 'longText1',
		productionHeader: 'LongText1',
		label: 'Long text',
		role: 'VO script, quote body, weather copy',
		mappable: true,
		writtenOnPush: true
	},
	{
		letter: 'E',
		key: 'headline1',
		productionHeader: 'Headline1',
		label: 'Headline 1',
		role: 'Title line (headlines) or guest name (remote)',
		mappable: true,
		writtenOnPush: true
	},
	{
		letter: 'F',
		key: 'headline2',
		productionHeader: 'Headline2',
		label: 'Headline 2',
		role: 'Subtitle (headlines) or role/title (remote)',
		mappable: true,
		writtenOnPush: true
	},
	{
		letter: 'G',
		key: 'preserved',
		productionHeader: 'READING TOTAL',
		label: 'Reading total',
		role: 'Timing / word count — sheet formulas, never cleared on push',
		mappable: false,
		writtenOnPush: false
	},
	{
		letter: 'H',
		key: 'preserved',
		productionHeader: 'Feedback',
		label: 'Feedback',
		role: 'OK / NOT OK from rehearsal — never cleared on push',
		mappable: false,
		writtenOnPush: false
	},
	{
		letter: 'I',
		key: 'transition',
		productionHeader: 'Transition DO riadka',
		label: 'Transition',
		role: 'Companion cue (Headline 1–3, ILU TO SYN, Spravy JV, …)',
		mappable: true,
		writtenOnPush: true
	},
	{
		letter: 'J',
		key: 'playout',
		productionHeader: 'Playout',
		label: 'Playout',
		role: 'Media cue (HEADLINE1, ILU RUMUNSKO, SYN …)',
		mappable: true,
		writtenOnPush: true
	},
	{
		letter: 'K',
		key: 'volume',
		productionHeader: 'Hlasitost v %',
		label: 'Volume %',
		role: 'Derived from playout on push (40 headlines, 50 ILU, 100 SYN, …)',
		mappable: false,
		writtenOnPush: true
	}
]

/** Example rows from a production-hot Friday sheet (illustrates 1:1 mapping). */
export const PRODUCTION_HOT_SHEET_EXAMPLES = [
	{
		block: '(guide)',
		longText1: 'Normal text',
		headline1: 'Title',
		headline2: 'Subtitle',
		transition: 'BLANK',
		playout: 'Heading2',
		note: 'Row 2 style guide — maps to head piece title/subtitle'
	},
	{
		block: '—',
		longText1: 'VO…',
		headline1: 'Ruský dron',
		headline2: 'v Rumunsku',
		transition: 'Headline 1',
		playout: 'HEADLINE1',
		note: 'Headline 1 — volume 40'
	},
	{
		block: 'INTRO',
		headline1: 'Gabriela Kajtárová',
		transition: 'Intro',
		playout: 'Intro',
		note: 'Intro row after headlines'
	},
	{
		block: 'Dron v Rumunsku',
		headline1: 'Nicusor Dan',
		headline2: 'rumunský prezident',
		transition: 'ILU TO SYN',
		playout: 'SYN RUMUN',
		note: 'Remote-style row inside a block'
	},
	{
		block: 'SPRÁVY JEDNOU VETOU',
		headline1: 'Benzín za 1,80€',
		transition: 'Spravy JV',
		playout: 'ILU PALIVO',
		note: 'One-sentence segment'
	}
] as const

/** What Push generates automatically (not controlled by piece mappings). */
export const VMIX_SHEET_PUSH_AUTOMATION = [
	'Row order: headline rows → intro → segments by rank (matches on-air order from your sheet).',
	'Headlines: three head pieces → Headline 1–3, HEADLINE1–3, volume 40%.',
	'Intro, ŠPORT, POČASIE, SPRÁVY JEDNOU VETOU, ZÁVER use the same block names and transitions as in production-hot.',
	'ILU / SYN rows: block = topic name; ILU↔SYN transitions recalculated from playout (e.g. ILU TO SYN, SYN TO ILU).',
	'Push writes only C–F and I–K. Columns A–B (notes) and G–H (reading total, feedback) are left intact.',
	'Columns L+ (weather cities, deck codes, …) are not touched — still maintained in the sheet.'
] as const

/** What Pull does today (piece mappings in Settings). */
export const VMIX_SHEET_PULL_AUTOMATION = [
	'Only piece types listed under Settings → mappings are updated from the sheet.',
	'Each mapping can filter rows by transition text (e.g. Headline for head pieces).',
	'Extra matching sheet rows create new parts in the same segment (e.g. a fourth headline).',
	'Pull reads C–F and I–J only; it does not change transitions, playout, or reading/feedback columns.',
	'Use Push after structural edits in Rundown Editor; use Pull when someone edited E/F/D in Sheets.'
] as const
