import type { Application, Request, Response } from 'express'
import {
	computeVolume,
	enrichRowsWithPieces,
	mapNrcsToSheetRows,
	parseNrcsRundown,
	recalculateTransitions,
	sheetRowsToCoreColumns,
	sheetRowsToCsv,
	testGoogleSheetsConnection,
	writeSheetRowsResolved
} from '../background/adapters/sheets'
import {
	getApplicationSettingsForSheets,
	getGoogleSheetsCredentials,
	isGoogleSheetsConfigured,
	resolveGoogleSheetsConfig
} from '../background/googleSheetsConfig'

function sendJson(res: Response, status: number, body: unknown): void {
	res.status(status).json(body)
}

function parseErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : 'Invalid NRCS payload'
}

const SHEET_ROW_COLUMNS = [
	'block',
	'longText1',
	'headline1',
	'headline2',
	'transition',
	'playout',
	'volume',
	'l3dStart',
	'l3dDuration'
] as const

function resolveRundownId(req: Request): string | undefined {
	const fromQuery = req.query.rundownId
	if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()
	const body = req.body
	if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
		const fromBody = (body as { rundownId?: unknown }).rundownId
		if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim()
	}
	return undefined
}

function finalizeSheetRows(rows: ReturnType<typeof mapNrcsToSheetRows>) {
	const withTransitions = recalculateTransitions(rows)
	return withTransitions.map((row) => ({
		...row,
		volume: computeVolume(row.playout)
	}))
}

function mapNrcsBody(body: unknown): ReturnType<typeof mapNrcsToSheetRows> {
	if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
		throw new Error('Request body must be a JSON object')
	}
	const input = parseNrcsRundown(body)
	return finalizeSheetRows(mapNrcsToSheetRows(input))
}

export function registerNrcsSheetsRoutes(app: Application): void {
	app.get('/api/google-sheets/status', async (_req: Request, res: Response) => {
		const settings = await getApplicationSettingsForSheets()
		const configured = await isGoogleSheetsConfigured()
		const config = await resolveGoogleSheetsConfig()
		sendJson(res, 200, {
			configured,
			spreadsheetId: config?.spreadsheetId ?? settings?.googleSheetsSpreadsheetId ?? null,
			sheetName: config?.sheetName ?? settings?.googleSheetsSheetName ?? null,
			dataStartRow: config?.startRow ?? settings?.googleSheetsDataStartRow ?? 2,
			hasCredentials: Boolean(getGoogleSheetsCredentials(settings))
		})
	})

	app.post('/api/google-sheets/test', async (_req: Request, res: Response) => {
		const settings = await getApplicationSettingsForSheets()
		const config = await resolveGoogleSheetsConfig()
		const credentials = getGoogleSheetsCredentials(settings)
		if (!config || !credentials) {
			sendJson(res, 400, {
				error:
					'Google Sheets is not fully configured. Set spreadsheet ID and service account credentials in Settings → Connection or via environment variables.'
			})
			return
		}
		try {
			const result = await testGoogleSheetsConnection(config, credentials)
			sendJson(res, 200, { ok: true, ...result })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			sendJson(res, 502, { ok: false, error: message })
		}
	})

	/**
	 * POST /api/nrcs/map-to-rows
	 * Body: NRCS rundown JSON. Returns ordered sheet rows (no Google API call).
	 */
	app.post('/api/nrcs/map-to-rows', (req: Request, res: Response) => {
		let rows
		try {
			rows = mapNrcsBody(req.body)
		} catch (err) {
			sendJson(res, 400, { error: parseErrorMessage(err) })
			return
		}
		sendJson(res, 200, {
			rows,
			columns: [...SHEET_ROW_COLUMNS],
			coreColumns: sheetRowsToCoreColumns(rows),
			csv: sheetRowsToCsv(rows)
		})
	})

	/**
	 * POST /api/nrcs/export-to-sheet
	 * Body: NRCS rundown JSON. Maps rows and optionally writes to Google Sheets when configured.
	 * Query: ?write=true to push to Sheets (requires env credentials).
	 * Optional rundownId (query or body): when set, enriches rows with l3d timing from DB parts/pieces.
	 */
	app.post('/api/nrcs/export-to-sheet', async (req: Request, res: Response) => {
		let rows
		try {
			rows = mapNrcsBody(req.body)
		} catch (err) {
			sendJson(res, 400, { error: parseErrorMessage(err) })
			return
		}
		const rundownId = resolveRundownId(req)
		if (rundownId) {
			rows = await enrichRowsWithPieces(rows, rundownId)
		}
		const shouldWrite =
			req.query.write === 'true' || req.query.write === '1' || req.body?.writeToSheet === true

		const sheetsConfigured = await isGoogleSheetsConfigured()
		const payload: Record<string, unknown> = {
			rows,
			columns: [...SHEET_ROW_COLUMNS],
			coreColumns: sheetRowsToCoreColumns(rows),
			csv: sheetRowsToCsv(rows),
			sheetsConfigured
		}

		if (shouldWrite) {
			const settings = await getApplicationSettingsForSheets()
			const config = await resolveGoogleSheetsConfig()
			const credentials = getGoogleSheetsCredentials(settings)
			if (!config || !credentials) {
				sendJson(res, 503, {
					error:
						'Google Sheets is not configured. Set spreadsheet ID and credentials in Settings → Connection or via GOOGLE_SHEETS_* env vars.',
					...payload
				})
				return
			}
			try {
				const writeResult = await writeSheetRowsResolved(rows, config, credentials)
				payload.sheetWrite = writeResult
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				sendJson(res, 502, { error: message, ...payload })
				return
			}
		}

		sendJson(res, 200, payload)
	})

	/**
	 * POST /api/rundowns/:rundownId/google-sheets/sync
	 * Body: NRCS rundown JSON. Maps rows, enriches l3d timing from this rundown, writes to Google Sheets.
	 */
	app.post('/api/rundowns/:rundownId/google-sheets/sync', async (req: Request, res: Response) => {
		const rundownId = String(req.params.rundownId ?? '').trim()
		if (!rundownId) {
			sendJson(res, 400, { error: 'rundownId is required' })
			return
		}

		let rows
		try {
			rows = mapNrcsBody(req.body)
		} catch (err) {
			sendJson(res, 400, { error: parseErrorMessage(err) })
			return
		}

		rows = await enrichRowsWithPieces(rows, rundownId)

		const sheetsConfigured = await isGoogleSheetsConfigured()
		if (!sheetsConfigured) {
			sendJson(res, 503, {
				error:
					'Google Sheets is not configured. Set spreadsheet ID and credentials in Settings → Connection or via GOOGLE_SHEETS_* env vars.',
				sheetsConfigured: false,
				rowCount: rows.length
			})
			return
		}

		const settings = await getApplicationSettingsForSheets()
		const config = await resolveGoogleSheetsConfig()
		const credentials = getGoogleSheetsCredentials(settings)
		if (!config || !credentials) {
			sendJson(res, 503, {
				error: 'Google Sheets configuration or credentials are missing.',
				sheetsConfigured: false,
				rowCount: rows.length
			})
			return
		}

		try {
			const writeResult = await writeSheetRowsResolved(rows, config, credentials)
			sendJson(res, 200, {
				ok: true,
				sheetsConfigured: true,
				rowCount: rows.length,
				sheetWrite: writeResult
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			sendJson(res, 502, { error: message, sheetsConfigured: true, rowCount: rows.length })
		}
	})
}
