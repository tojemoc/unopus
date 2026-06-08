import type { Express, Request, Response } from 'express'
import {
	reconcileAllEnabledTemplates,
	reconcileTemplateSchedule,
	regenerateFromTemplate
} from '../background/rundownSchedule'

function sendJson(res: Response, status: number, body: unknown): void {
	res.status(status).json(body)
}

export function registerRundownScheduleRoutes(app: Express): void {
	app.post('/api/rundowns/schedule/reconcile', async (_req: Request, res: Response) => {
		try {
			await reconcileAllEnabledTemplates()
			sendJson(res, 200, { ok: true })
		} catch (err) {
			console.error('POST /api/rundowns/schedule/reconcile failed', err)
			sendJson(res, 500, {
				ok: false,
				error: err instanceof Error ? err.message : String(err)
			})
		}
	})

	app.post('/api/rundowns/templates/:templateId/reconcile', async (req: Request, res: Response) => {
		try {
			const templateId = String(req.params.templateId).trim()
			const created = await reconcileTemplateSchedule(templateId)
			sendJson(res, 200, { created: created.length, rundowns: created })
		} catch (err) {
			console.error('POST /api/rundowns/templates/:templateId/reconcile failed', err)
			sendJson(res, 500, {
				ok: false,
				error: err instanceof Error ? err.message : String(err)
			})
		}
	})

	app.post('/api/rundowns/templates/:templateId/regenerate', async (req: Request, res: Response) => {
		try {
			const templateId = String(req.params.templateId).trim()
			const { result, error } = await regenerateFromTemplate(templateId)
			if (error) {
				sendJson(res, 400, {
					ok: false,
					error: error.message,
					...(result ?? {})
				})
				return
			}
			sendJson(res, 200, result)
		} catch (err) {
			console.error('POST /api/rundowns/templates/:templateId/regenerate failed', err)
			sendJson(res, 500, {
				ok: false,
				error: err instanceof Error ? err.message : String(err)
			})
		}
	})
}
