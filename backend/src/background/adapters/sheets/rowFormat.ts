import { SHEET_COLUMN_INDEX } from './types'
import type { SheetRow } from './types'

function volumeToCell(volume: SheetRow['volume']): string {
	if (volume === '' || volume === undefined) return ''
	return String(volume)
}

function l3dNumberToCell(value: number | '' | undefined): string {
	if (value === '' || value === undefined) return ''
	return String(value)
}

/** Full A–M row with empty cells in unused columns (matches sheet column positions). */
export function sheetRowToSpreadsheetCells(row: SheetRow): string[] {
	const cells = new Array<string>(13).fill('')
	cells[SHEET_COLUMN_INDEX.C] = row.block
	cells[SHEET_COLUMN_INDEX.D] = row.longText1
	cells[SHEET_COLUMN_INDEX.E] = row.headline1
	cells[SHEET_COLUMN_INDEX.F] = row.headline2
	cells[SHEET_COLUMN_INDEX.I] = row.transition
	cells[SHEET_COLUMN_INDEX.J] = row.playout
	cells[SHEET_COLUMN_INDEX.K] = volumeToCell(row.volume)
	cells[SHEET_COLUMN_INDEX.L] = l3dNumberToCell(row.l3dStart)
	cells[SHEET_COLUMN_INDEX.M] = l3dNumberToCell(row.l3dDuration)
	return cells
}

export function sheetRowsToSpreadsheetMatrix(rows: SheetRow[]): string[][] {
	return rows.map(sheetRowToSpreadsheetCells)
}

/** C–K core fields (block through volume; G–H omitted as unused in sheet layout). */
export function sheetRowsToCoreColumns(rows: SheetRow[]): string[][] {
	return rows.map((row) => [
		row.block,
		row.longText1,
		row.headline1,
		row.headline2,
		row.transition,
		row.playout,
		volumeToCell(row.volume)
	])
}

function escapeCsvField(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`
	}
	return value
}

/** CSV with columns A–M so column letters align when imported into Google Sheets. */
export function sheetRowsToCsv(rows: SheetRow[]): string {
	const lines = sheetRowsToSpreadsheetMatrix(rows).map((cells) =>
		cells.map(escapeCsvField).join(',')
	)
	return lines.join('\n')
}
