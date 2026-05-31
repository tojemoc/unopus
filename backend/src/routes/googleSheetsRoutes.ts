import type { Application, Request, Response } from 'express'
import {
	computeVolume,
	mapRundownToSheetRows,
	pullRundownFromGoogleSheets,
	readSheetRowsResolved,
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
	return err instanceof Error ? err.message : 'Request failed'
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

export function registerGoogleSheetsRoutes(app: Application): void {
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
	 * GET /api/rundowns/:rundownId/google-sheets/preview
	 * Maps the rundown to sheet rows without calling Google.
	 */
	app.get('/api/rundowns/:rundownId/google-sheets/preview', async (req: Request, res: Response) => {
		const rundownId = String(req.params.rundownId ?? '').trim()
		if (!rundownId) {
			sendJson(res, 400, { error: 'rundownId is required' })
			return
		}

		const settings = await getApplicationSettingsForSheets()
		let rows: SheetRow[]
		try {
			rows = finalizeSheetRows(
				await mapRundownToSheetRows(rundownId, settings?.googleSheetsPieceMappings)
			)
		} catch (err) {
			sendJson(res, isRundownNotFoundError(err) ? 404 : 400, { error: parseErrorMessage(err) })
			return
		}

		sendJson(res, 200, {
			rows,
			rowCount: rows.length,
			coreColumns: sheetRowsToCoreColumns(rows),
			csv: sheetRowsToCsv(rows)
		})
	})

	/**
	 * POST /api/rundowns/:rundownId/google-sheets/sync-from-rundown
	 * Push Rundown Editor content to Google Sheets.
	 */
	app.post(
		'/api/rundowns/:rundownId/google-sheets/sync-from-rundown',
		async (req: Request, res: Response) => {
			const rundownId = String(req.params.rundownId ?? '').trim()
			if (!rundownId) {
				sendJson(res, 400, { error: 'rundownId is required' })
				return
			}

			const settings = await getApplicationSettingsForSheets()
			let rows: SheetRow[]
			try {
				rows = finalizeSheetRows(
					await mapRundownToSheetRows(rundownId, settings?.googleSheetsPieceMappings)
				)
			} catch (err) {
				sendJson(res, isRundownNotFoundError(err) ? 404 : 400, { error: parseErrorMessage(err) })
				return
			}

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

	/**
	 * POST /api/rundowns/:rundownId/google-sheets/pull
	 * Pull mapped columns from Google Sheets into the rundown.
	 */
	app.post('/api/rundowns/:rundownId/google-sheets/pull', async (req: Request, res: Response) => {
		const rundownId = String(req.params.rundownId ?? '').trim()
		if (!rundownId) {
			sendJson(res, 400, { error: 'rundownId is required' })
			return
		}

		const settings = await getApplicationSettingsForSheets()
		const config = await resolveGoogleSheetsConfig()
		const credentials = getGoogleSheetsCredentials(settings)
		if (!config || !credentials) {
			sendJson(res, 503, {
				error: 'Google Sheets configuration or credentials are missing.'
			})
			return
		}

		try {
			const sheetRows = await readSheetRowsResolved(config, credentials)
			const pullResult = await pullRundownFromGoogleSheets(
				rundownId,
				sheetRows,
				settings ?? undefined
			)
			sendJson(res, 200, {
				ok: true,
				sheetRowCount: sheetRows.length,
				...pullResult
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			sendJson(res, isRundownNotFoundError(err) ? 404 : 502, { error: message })
		}
	})
}
