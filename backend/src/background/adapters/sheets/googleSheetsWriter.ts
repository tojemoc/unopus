import fs from 'fs'
import { google, type sheets_v4 } from 'googleapis'
import type { SheetRow } from './types'
import { sheetRowsToSpreadsheetMatrix } from './rowFormat'
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

function buildRange(sheetName: string | undefined, startRow: number, rowCount?: number): string {
	const range =
		rowCount === undefined ? `A${startRow}:M` : `A${startRow}:M${startRow + rowCount - 1}`
	return sheetName ? `'${sheetName.replace(/'/g, "''")}'!${range}` : range
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

/** Probe cell in column O (outside A–M automation columns). */
function buildWriteProbeRange(sheetName: string | undefined, row: number): string {
	const cell = `O${row}`
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
	const readRange = buildRange(config.sheetName, config.startRow ?? 2, 1)
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
 * Clears existing data rows from startRow downward (columns A–M), then writes new rows.
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
	const matrix = sheetRowsToSpreadsheetMatrix(prepareRowsForSheet(rows))
	const clearRange = buildRange(config.sheetName, startRow)

	await sheets.spreadsheets.values.clear({
		spreadsheetId: config.spreadsheetId,
		range: clearRange
	})

	if (matrix.length === 0) {
		return { updatedRange: clearRange, rowCount: 0 }
	}

	const updateRange = buildRange(config.sheetName, startRow, matrix.length)
	const response = await sheets.spreadsheets.values.update({
		spreadsheetId: config.spreadsheetId,
		range: updateRange,
		valueInputOption: 'USER_ENTERED',
		requestBody: { values: matrix }
	})

	const updatedRange =
		response.data.updatedRange ??
		`${columnLetter(0)}${startRow}:${columnLetter(12)}${startRow + matrix.length - 1}`

	return {
		updatedRange,
		rowCount: matrix.length
	}
}

export async function writeSheetRowsResolved(
	rows: SheetRow[],
	config: GoogleSheetsWriterConfig,
	credentials: object
): Promise<GoogleSheetsWriteResult> {
	return writeSheetRows(rows, config, credentials)
}

export async function writeSheetRowsFromEnv(rows: SheetRow[]): Promise<GoogleSheetsWriteResult> {
	const config = getGoogleSheetsConfigFromEnv()
	if (!config) {
		throw new Error('Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID.')
	}
	return writeSheetRows(rows, config)
}
