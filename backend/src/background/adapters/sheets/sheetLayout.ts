import type { GoogleSheetsColumnKey } from './sheetMapping'

/** One column in the vMix / Companion automation sheet (rows A–K). */
export interface VmixSheetColumnSpec {
	/** Spreadsheet column letter. */
	letter: string
	/** Field on SheetRow used for push/pull mappings. */
	key: GoogleSheetsColumnKey | 'volume'
	/** Short label for UI. */
	label: string
	/** What operators put here today (docs + Sheets workflow). */
	role: string
	/** Whether piece-type mappings can read/write this column. */
	mappable: boolean
}

/**
 * vMix automation layout (columns A–K). Matches the spreadsheet Companion reads.
 * Rundown Editor push fills C–K; pull uses Settings mappings for selected piece types.
 */
export const VMIX_AUTOMATION_SHEET_COLUMNS: VmixSheetColumnSpec[] = [
	{ letter: 'A', key: 'volume', label: '—', role: 'Unused in automation', mappable: false },
	{ letter: 'B', key: 'volume', label: '—', role: 'Unused in automation', mappable: false },
	{
		letter: 'C',
		key: 'block',
		label: 'Block',
		role: 'Story block name (segment / topic)',
		mappable: true
	},
	{
		letter: 'D',
		key: 'longText1',
		label: 'Long text',
		role: 'VO script, quote body, weather text',
		mappable: true
	},
	{
		letter: 'E',
		key: 'headline1',
		label: 'Headline 1',
		role: 'Primary lower-third line (headline title, guest name)',
		mappable: true
	},
	{
		letter: 'F',
		key: 'headline2',
		label: 'Headline 2',
		role: 'Secondary lower-third line (subtitle, role)',
		mappable: true
	},
	{ letter: 'G', key: 'volume', label: '—', role: 'Unused', mappable: false },
	{ letter: 'H', key: 'volume', label: '—', role: 'Unused', mappable: false },
	{
		letter: 'I',
		key: 'transition',
		label: 'Transition',
		role: 'Companion transition cue (computed on push)',
		mappable: true
	},
	{
		letter: 'J',
		key: 'playout',
		label: 'Playout',
		role: 'ILU / SYN / HEADLINE file cue',
		mappable: true
	},
	{
		letter: 'K',
		key: 'volume',
		label: 'Volume',
		role: 'Derived from playout on push (not mapped manually)',
		mappable: false
	}
]

/** What Push generates automatically (not controlled by piece mappings). */
export const VMIX_SHEET_PUSH_AUTOMATION = [
	'Row order: headline rows → intro → segments by rank (same order as on-air).',
	'Headlines: up to three parts with a head piece → transitions Headline 1–3, playout HEADLINE1–3.',
	'Intro, sport, weather, one-sentence, and outro blocks use fixed block names and transitions.',
	'Video / remote / ILU rows: block = segment name; transitions ILU↔SYN are recalculated from playout cues.',
	'Column K (volume) is filled from playout rules on push.'
] as const

/** What Pull does today (piece mappings in Settings). */
export const VMIX_SHEET_PULL_AUTOMATION = [
	'Only piece types listed under Settings → mappings are updated from the sheet.',
	'Each mapping can filter rows by transition text (e.g. Headline for head pieces).',
	'Extra matching sheet rows create new parts in the same segment (e.g. a fourth headline).',
	'Segment order, transitions, and playout cues are not rebuilt from the sheet on pull — use Push for that.'
] as const
