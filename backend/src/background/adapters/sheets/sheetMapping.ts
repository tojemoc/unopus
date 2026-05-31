import type { PayloadValue } from '../../interfaces'
import type { SheetRow } from './types'

/** Sheet columns used by the vMix automation layout (logical fields on SheetRow). */
export type GoogleSheetsColumnKey = keyof Pick<
	SheetRow,
	'block' | 'longText1' | 'headline1' | 'headline2' | 'transition' | 'playout'
>

/** Maps a piece payload field (or `part.script`) to a sheet column. */
export interface GoogleSheetsFieldMapping {
	sourceField: string
	sheetColumn: GoogleSheetsColumnKey
}

/** Per piece-type rules for push/pull between Rundown Editor and Google Sheets. */
export interface GoogleSheetsPieceTypeMapping {
	pieceTypeId: string
	/** Shown in Settings (defaults to piece type id). */
	label?: string
	/** Short explanation of what this mapping is for. */
	description?: string
	fields: GoogleSheetsFieldMapping[]
	/** Max sheet rows for this piece type (e.g. three headlines). */
	maxRows?: number
	/**
	 * When set, only sheet rows whose transition contains this string (case-insensitive)
	 * are used for pull and counted for push ordering.
	 */
	transitionContains?: string
}

export const GOOGLE_SHEETS_COLUMN_OPTIONS: { value: GoogleSheetsColumnKey; label: string }[] = [
	{ value: 'block', label: 'Block (C)' },
	{ value: 'longText1', label: 'Long text (D)' },
	{ value: 'headline1', label: 'Headline 1 (E)' },
	{ value: 'headline2', label: 'Headline 2 (F)' },
	{ value: 'transition', label: 'Transition (I)' },
	{ value: 'playout', label: 'Playout (J)' }
]

/** Recommended bridge mappings (1:1 with the Sheets + Companion workflow). */
export const GOOGLE_SHEETS_RECOMMENDED_MAPPINGS: GoogleSheetsPieceTypeMapping[] = [
	{
		pieceTypeId: 'head',
		label: 'Headline',
		description:
			'Three headline rows at the top of the sheet. Title → E, subtitle → F, VO script → D. Pull only touches rows whose transition contains “Headline”.',
		maxRows: 3,
		transitionContains: 'Headline',
		fields: [
			{ sourceField: 'title', sheetColumn: 'headline1' },
			{ sourceField: 'subtitle', sheetColumn: 'headline2' },
			{ sourceField: 'part.script', sheetColumn: 'longText1' }
		]
	}
]

export const DEFAULT_GOOGLE_SHEETS_PIECE_MAPPINGS = GOOGLE_SHEETS_RECOMMENDED_MAPPINGS

export function resolveGoogleSheetsPieceMappings(
	mappings: GoogleSheetsPieceTypeMapping[] | undefined
): GoogleSheetsPieceTypeMapping[] {
	if (!mappings || mappings.length === 0) {
		return DEFAULT_GOOGLE_SHEETS_PIECE_MAPPINGS
	}
	return mappings
}

export function mappingForPieceType(
	pieceTypeId: string,
	mappings: GoogleSheetsPieceTypeMapping[] | undefined
): GoogleSheetsPieceTypeMapping | undefined {
	const normalized = pieceTypeId.trim().toLowerCase()
	return resolveGoogleSheetsPieceMappings(mappings).find(
		(m) => m.pieceTypeId.trim().toLowerCase() === normalized
	)
}

export function sheetColumnValue(row: SheetRow, column: GoogleSheetsColumnKey): string {
	return row[column]?.trim() ?? ''
}

export function applyFieldMappingsToPayload(
	payload: Record<string, PayloadValue>,
	fields: GoogleSheetsFieldMapping[],
	row: SheetRow
): void {
	for (const field of fields) {
		if (field.sourceField.startsWith('part.')) continue
		const value = sheetColumnValue(row, field.sheetColumn)
		if (value) payload[field.sourceField] = value
	}
}

export function partScriptFromRow(fields: GoogleSheetsFieldMapping[], row: SheetRow): string | undefined {
	const scriptMapping = fields.find((f) => f.sourceField === 'part.script')
	if (!scriptMapping) return undefined
	const value = sheetColumnValue(row, scriptMapping.sheetColumn)
	return value || undefined
}

export function payloadToSheetRowFields(
	payload: Record<string, unknown>,
	fields: GoogleSheetsFieldMapping[],
	partScript?: string
): Partial<SheetRow> {
	const partial: Partial<SheetRow> = {}
	for (const field of fields) {
		if (field.sourceField === 'part.script') {
			if (partScript?.trim()) partial[field.sheetColumn] = partScript.trim()
			continue
		}
		const value = payload[field.sourceField]
		if (typeof value === 'string' && value.trim()) {
			partial[field.sheetColumn] = value.trim()
		}
	}
	return partial
}

export function sheetRowMatchesMapping(row: SheetRow, mapping: GoogleSheetsPieceTypeMapping): boolean {
	if (!mapping.transitionContains?.trim()) return true
	const needle = mapping.transitionContains.trim().toLowerCase()
	return row.transition.trim().toLowerCase().includes(needle)
}
