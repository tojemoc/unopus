import { SHEET_COLUMN_INDEX } from './types'
import type { SheetRow } from './types'

/** Full A–J row with empty cells in unused columns (matches sheet column positions). */
export function sheetRowToSpreadsheetCells(row: SheetRow): string[] {
	const cells = new Array<string>(10).fill('')
	cells[SHEET_COLUMN_INDEX.C] = row.block
	cells[SHEET_COLUMN_INDEX.D] = row.longText1
	cells[SHEET_COLUMN_INDEX.E] = row.headline1
	cells[SHEET_COLUMN_INDEX.F] = row.headline2
	cells[SHEET_COLUMN_INDEX.I] = row.transition
	cells[SHEET_COLUMN_INDEX.J] = row.playout
	return cells
}

export function sheetRowsToSpreadsheetMatrix(rows: SheetRow[]): string[][] {
	return rows.map(sheetRowToSpreadsheetCells)
}

/** C–J values only (compact 2D array). */
export function sheetRowsToCoreColumns(rows: SheetRow[]): string[][] {
	return rows.map((row) => [
		row.block,
		row.longText1,
		row.headline1,
		row.headline2,
		row.transition,
		row.playout
	])
}

function escapeCsvField(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`
	}
	return value
}

/** CSV with columns A–J so column letters align when imported into Google Sheets. */
export function sheetRowsToCsv(rows: SheetRow[]): string {
	const lines = sheetRowsToSpreadsheetMatrix(rows).map((cells) =>
		cells.map(escapeCsvField).join(',')
	)
	return lines.join('\n')
}
