import { SHEET_COLUMN_INDEX } from './types'
import type { SheetRow } from './types'

function volumeToCell(volume: SheetRow['volume']): string {
	if (volume === '' || volume === undefined) return ''
	return String(volume)
}

/** Full A–K row with empty cells in unused columns (matches sheet column positions). */
export function sheetRowToSpreadsheetCells(row: SheetRow): string[] {
	const cells = new Array<string>(11).fill('')
	cells[SHEET_COLUMN_INDEX.C] = row.block
	cells[SHEET_COLUMN_INDEX.D] = row.longText1
	cells[SHEET_COLUMN_INDEX.E] = row.headline1
	cells[SHEET_COLUMN_INDEX.F] = row.headline2
	cells[SHEET_COLUMN_INDEX.I] = row.transition
	cells[SHEET_COLUMN_INDEX.J] = row.playout
	cells[SHEET_COLUMN_INDEX.K] = volumeToCell(row.volume)
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

/** Parse A–K rows returned by the Google Sheets API into SheetRow objects. */
export function spreadsheetMatrixToSheetRows(matrix: string[][]): SheetRow[] {
	return matrix.map((cells) => {
		const get = (index: number) => (cells[index] ?? '').trim()
		const volumeRaw = get(SHEET_COLUMN_INDEX.K)
		let volume: SheetRow['volume'] = ''
		if (volumeRaw !== '') {
			const parsed = Number(volumeRaw)
			volume = Number.isFinite(parsed) ? parsed : ''
		}
		return {
			block: get(SHEET_COLUMN_INDEX.C),
			longText1: get(SHEET_COLUMN_INDEX.D),
			headline1: get(SHEET_COLUMN_INDEX.E),
			headline2: get(SHEET_COLUMN_INDEX.F),
			transition: get(SHEET_COLUMN_INDEX.I),
			playout: get(SHEET_COLUMN_INDEX.J),
			volume
		}
	})
}

/** CSV with columns A–K so column letters align when imported into Google Sheets. */
export function sheetRowsToCsv(rows: SheetRow[]): string {
	const lines = sheetRowsToSpreadsheetMatrix(rows).map((cells) =>
		cells.map(escapeCsvField).join(',')
	)
	return lines.join('\n')
}
