import type { Application, Request, Response } from 'express'
import {
	computeVolume,
	mapNrcsToSheetRows,
	mapRundownToSheetRows,
	parseNrcsRundown,
	recalculateTransitions,
	sheetRowsToCoreColumns,
	sheetRowsToCsv,
	testGoogleSheetsConnection,
	writeSheetRowsResolved
} from '../background/adapters/sheets'
import type { SheetRow } from '../background/adapters/sheets'
import {
	getApplicationSettingsForSheets,
	getGoogleSheetsCredentials,
	resolveGoogleSheetsConfig
} from '../background/googleSheetsConfig'

function sendJson(res: Response, status: number, body: unknown): void {
	res.status(status).json(body)
}

function parseErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : 'Invalid NRCS payload'
}

function isRundownNotFoundError(err: unknown): boolean {
	const message = parseErrorMessage(err)
	return /rundown not found/i.test(message)
}

function finalizeSheetRows(rows: SheetRow[]) {
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
		const config = await resolveGoogleSheetsConfig()
		sendJson(res, 200, {
			configured: Boolean(config && getGoogleSheetsCredentials(settings)),
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
			coreColumns: sheetRowsToCoreColumns(rows),
			csv: sheetRowsToCsv(rows)
		})
	})

	/**
	 * POST /api/rundowns/:rundownId/google-sheets/sync
	 * Body: NRCS rundown JSON. Maps rows and writes to Google Sheets.
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

		const settings = await getApplicationSettingsForSheets()
		const config = await resolveGoogleSheetsConfig()
		const credentials = getGoogleSheetsCredentials(settings)
		if (!config || !credentials) {
			sendJson(res, 503, {
				error: 'Google Sheets configuration or credentials are missing.',
				rowCount: rows.length
			})
			return
		}

		try {
			const writeResult = await writeSheetRowsResolved(rows, config, credentials)
			sendJson(res, 200, {
				ok: true,
				rowCount: rows.length,
				sheetWrite: writeResult
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			sendJson(res, 502, { error: message, rowCount: rows.length })
		}
	})

	/**
	 * POST /api/rundowns/:rundownId/google-sheets/sync-from-rundown
	 * Maps Rundown Editor segments/parts/pieces and writes to Google Sheets.
	 */
	app.post(
		'/api/rundowns/:rundownId/google-sheets/sync-from-rundown',
		async (req: Request, res: Response) => {
			const rundownId = String(req.params.rundownId ?? '').trim()
			if (!rundownId) {
				sendJson(res, 400, { error: 'rundownId is required' })
				return
			}

			let rows: SheetRow[]
			try {
				rows = finalizeSheetRows(await mapRundownToSheetRows(rundownId))
			} catch (err) {
				const error = parseErrorMessage(err)
				sendJson(res, isRundownNotFoundError(err) ? 404 : 400, { error })
				return
			}

			const settings = await getApplicationSettingsForSheets()
			const config = await resolveGoogleSheetsConfig()
			const credentials = getGoogleSheetsCredentials(settings)
			if (!config || !credentials) {
				sendJson(res, 503, {
					error: 'Google Sheets configuration or credentials are missing.',
					rowCount: rows.length
				})
				return
			}

			try {
				const writeResult = await writeSheetRowsResolved(rows, config, credentials)
				sendJson(res, 200, {
					ok: true,
					rowCount: rows.length,
					sheetWrite: writeResult
				})
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				sendJson(res, 502, { error: message, rowCount: rows.length })
			}
		}
	)
}
