import type { Application, Request, Response } from 'express'
import {
	isGoogleSheetsConfigured,
	mapNrcsToSheetRows,
	parseNrcsRundown,
	sheetRowsToCoreColumns,
	sheetRowsToCsv,
	writeSheetRowsFromEnv
} from '../background/adapters/sheets'

function sendJson(res: Response, status: number, body: unknown): void {
	res.status(status).json(body)
}

function parseErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : 'Invalid NRCS payload'
}

function mapNrcsBody(body: unknown): ReturnType<typeof mapNrcsToSheetRows> {
	if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
		throw new Error('Request body must be a JSON object')
	}
	const input = parseNrcsRundown(body)
	return mapNrcsToSheetRows(input)
}

export function registerNrcsSheetsRoutes(app: Application): void {
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
			columns: ['block', 'longText1', 'headline1', 'headline2', 'transition', 'playout'],
			coreColumns: sheetRowsToCoreColumns(rows),
			csv: sheetRowsToCsv(rows)
		})
	})

	/**
	 * POST /api/nrcs/export-to-sheet
	 * Body: NRCS rundown JSON. Maps rows and optionally writes to Google Sheets when configured.
	 * Query: ?write=true to push to Sheets (requires env credentials).
	 */
	app.post('/api/nrcs/export-to-sheet', async (req: Request, res: Response) => {
		let rows
		try {
			rows = mapNrcsBody(req.body)
		} catch (err) {
			sendJson(res, 400, { error: parseErrorMessage(err) })
			return
		}
		const shouldWrite =
			req.query.write === 'true' || req.query.write === '1' || req.body?.writeToSheet === true

		const payload: Record<string, unknown> = {
			rows,
			columns: ['block', 'longText1', 'headline1', 'headline2', 'transition', 'playout'],
			coreColumns: sheetRowsToCoreColumns(rows),
			csv: sheetRowsToCsv(rows),
			sheetsConfigured: isGoogleSheetsConfigured()
		}

		if (shouldWrite) {
			if (!isGoogleSheetsConfigured()) {
				sendJson(res, 503, {
					error:
						'Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and credentials env vars.',
					...payload
				})
				return
			}
			try {
				const writeResult = await writeSheetRowsFromEnv(rows)
				payload.sheetWrite = writeResult
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				sendJson(res, 502, { error: message, ...payload })
				return
			}
		}

		sendJson(res, 200, payload)
	})
}
