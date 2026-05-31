import fs from 'fs'
import { google, type sheets_v4 } from 'googleapis'
import type { SheetRow } from './types'
import {
	sheetRowsToAutomationCdfMatrix,
	sheetRowsToAutomationIjkMatrix,
	spreadsheetMatrixToSheetRows
} from './rowFormat'
import { recalculateTransitions } from './transitions'
import { computeVolume } from './volume'

export interface GoogleSheetsWriterConfig {
	spreadsheetId: string
	sheetName?: string
	/** 1-based row where data starts (default 2, leaving row 1 as header). */
	startRow?: number
}

export interface GoogleSheetsWriteResult {
	updatedRange: string
	rowCount: number
}

function columnLetter(index: number): string {
	let n = index + 1
	let result = ''
	while (n > 0) {
		const rem = (n - 1) % 26
		result = String.fromCharCode(65 + rem) + result
		n = Math.floor((n - 1) / 26)
	}
	return result
}

function buildRange(
	sheetName: string | undefined,
	startRow: number,
	endColumn: string,
	rowCount?: number,
	startColumn = 'A'
): string {
	const range =
		rowCount === undefined
			? `${startColumn}${startRow}:${endColumn}`
			: `${startColumn}${startRow}:${endColumn}${startRow + rowCount - 1}`
	return sheetName ? `'${sheetName.replace(/'/g, "''")}'!${range}` : range
}

/** Production-hot layout: only automation columns (skips A–B notes and G–H formulas). */
function buildAutomationClearRanges(
	sheetName: string | undefined,
	startRow: number,
	rowCount: number
): string[] {
	if (rowCount <= 0) return []
	return [
		buildRange(sheetName, startRow, 'F', rowCount, 'C'),
		buildRange(sheetName, startRow, 'K', rowCount, 'I')
	]
}

export function loadCredentialsFromEnv(): object | null {
	const inline = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON?.trim()
	if (inline) {
		return JSON.parse(inline) as object
	}
	const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH?.trim()
	if (credentialsPath) {
		const raw = fs.readFileSync(credentialsPath, 'utf8')
		return JSON.parse(raw) as object
	}
	return null
}

export function getGoogleSheetsConfigFromEnv(): GoogleSheetsWriterConfig | null {
	const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()
	if (!spreadsheetId) return null
	return {
		spreadsheetId,
		sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME?.trim() || undefined,
		startRow: Math.max(Number(process.env.GOOGLE_SHEETS_DATA_START_ROW) || 2, 1)
	}
}

export function isGoogleSheetsConfigured(): boolean {
	try {
		return Boolean(getGoogleSheetsConfigFromEnv() && loadCredentialsFromEnv())
	} catch {
		return false
	}
}

async function createSheetsClient(credentials: object): Promise<sheets_v4.Sheets> {
	const auth = new google.auth.GoogleAuth({
		credentials,
		scopes: ['https://www.googleapis.com/auth/spreadsheets']
	})
	return google.sheets({ version: 'v4', auth })
}

/** Probe cell in column M (outside A–K automation columns). */
function buildWriteProbeRange(sheetName: string | undefined, row: number): string {
	const cell = `M${row}`
	return sheetName ? `'${sheetName.replace(/'/g, "''")}'!${cell}` : cell
}

export async function testGoogleSheetsConnection(
	config: GoogleSheetsWriterConfig,
	credentials: object
): Promise<{ title: string; sheetTitle?: string }> {
	const sheets = await createSheetsClient(credentials)
	const meta = await sheets.spreadsheets.get({ spreadsheetId: config.spreadsheetId })
	const title = meta.data.properties?.title ?? config.spreadsheetId
	const sheetTitle =
		config.sheetName ??
		meta.data.sheets?.[0]?.properties?.title ??
		undefined
	const readRange = buildRange(config.sheetName, config.startRow ?? 2, 'K', 1, 'A')
	await sheets.spreadsheets.values.get({
		spreadsheetId: config.spreadsheetId,
		range: readRange
	})

	const probeRow = config.startRow ?? 2
	const probeRange = buildWriteProbeRange(config.sheetName, probeRow)
	const prior = await sheets.spreadsheets.values.get({
		spreadsheetId: config.spreadsheetId,
		range: probeRange
	})
	const priorValue = prior.data.values?.[0]?.[0] ?? ''

	const probeToken = `__sofie_probe_${Date.now()}__`
	await sheets.spreadsheets.values.update({
		spreadsheetId: config.spreadsheetId,
		range: probeRange,
		valueInputOption: 'RAW',
		requestBody: { values: [[probeToken]] }
	})
	await sheets.spreadsheets.values.update({
		spreadsheetId: config.spreadsheetId,
		range: probeRange,
		valueInputOption: 'RAW',
		requestBody: { values: [[priorValue]] }
	})

	return { title, sheetTitle }
}

function prepareRowsForSheet(rows: SheetRow[]): SheetRow[] {
	const withTransitions = recalculateTransitions(rows)
	return withTransitions.map((row) => ({
		...row,
		volume: computeVolume(row.playout)
	}))
}

/**
 * Clears automation columns from startRow downward, then writes new rows.
 * Preserves columns A–B (editor notes) and G–H (READING TOTAL, Feedback) on production-hot sheets.
 */
export async function writeSheetRows(
	rows: SheetRow[],
	config: GoogleSheetsWriterConfig,
	credentials?: object
): Promise<GoogleSheetsWriteResult> {
	const creds = credentials ?? loadCredentialsFromEnv()
	if (!creds) {
		throw new Error(
			'Google Sheets credentials missing. Set GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEETS_CREDENTIALS_PATH.'
		)
	}
	const sheets = await createSheetsClient(creds)
	const startRow = config.startRow ?? 2
	const prepared = prepareRowsForSheet(rows)

	let existingRowCount = 0
	try {
		const existing = await readSheetRows(config, creds)
		existingRowCount = existing.length
	} catch (err) {
		console.error('readSheetRows failed while sizing sheet clear range:', err)
		existingRowCount = 0
	}

	const writeRowCount = prepared.length
	const clearRowCount = Math.max(existingRowCount, writeRowCount)

	for (const clearRange of buildAutomationClearRanges(
		config.sheetName,
		startRow,
		clearRowCount
	)) {
		await sheets.spreadsheets.values.clear({
			spreadsheetId: config.spreadsheetId,
			range: clearRange
		})
	}

	if (writeRowCount === 0) {
		const cleared = buildRange(config.sheetName, startRow, 'K', clearRowCount || undefined, 'C')
		return { updatedRange: cleared, rowCount: 0 }
	}

	const cdfMatrix = sheetRowsToAutomationCdfMatrix(prepared)
	const ijkMatrix = sheetRowsToAutomationIjkMatrix(prepared)
	const cdfRange = buildRange(config.sheetName, startRow, 'F', writeRowCount, 'C')
	const ijkRange = buildRange(config.sheetName, startRow, 'K', writeRowCount, 'I')

	const response = await sheets.spreadsheets.values.batchUpdate({
		spreadsheetId: config.spreadsheetId,
		requestBody: {
			valueInputOption: 'USER_ENTERED',
			data: [
				{ range: cdfRange, values: cdfMatrix },
				{ range: ijkRange, values: ijkMatrix }
			]
		}
	})

	const updatedRange =
		response.data.responses?.[0]?.updatedRange ??
		`C${startRow}:K${startRow + writeRowCount - 1}`

	return {
		updatedRange,
		rowCount: writeRowCount
	}
}

export async function writeSheetRowsResolved(
	rows: SheetRow[],
	config: GoogleSheetsWriterConfig,
	credentials: object
): Promise<GoogleSheetsWriteResult> {
	return writeSheetRows(rows, config, credentials)
}

/** Read all data rows from startRow downward (columns A–K). */
export async function readSheetRows(
	config: GoogleSheetsWriterConfig,
	credentials?: object
): Promise<SheetRow[]> {
	const creds = credentials ?? loadCredentialsFromEnv()
	if (!creds) {
		throw new Error(
			'Google Sheets credentials missing. Set GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEETS_CREDENTIALS_PATH.'
		)
	}
	const sheets = await createSheetsClient(creds)
	const startRow = config.startRow ?? 2
	const readRange = buildRange(config.sheetName, startRow, 'K', undefined, 'A')
	const response = await sheets.spreadsheets.values.get({
		spreadsheetId: config.spreadsheetId,
		range: readRange
	})
	const matrix = response.data.values ?? []
	return spreadsheetMatrixToSheetRows(matrix).filter((row) =>
		[row.block, row.longText1, row.headline1, row.headline2, row.transition, row.playout].some(
			(v) => v.trim().length > 0
		)
	)
}

export async function readSheetRowsResolved(
	config: GoogleSheetsWriterConfig,
	credentials: object
): Promise<SheetRow[]> {
	return readSheetRows(config, credentials)
}

export async function writeSheetRowsFromEnv(rows: SheetRow[]): Promise<GoogleSheetsWriteResult> {
	const config = getGoogleSheetsConfigFromEnv()
	if (!config) {
		throw new Error('Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID.')
	}
	return writeSheetRows(rows, config)
}
