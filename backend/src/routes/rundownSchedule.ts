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
		await reconcileAllEnabledTemplates()
		sendJson(res, 200, { ok: true })
	})

	app.post('/api/rundowns/templates/:templateId/reconcile', async (req: Request, res: Response) => {
		const templateId = String(req.params.templateId).trim()
		const created = await reconcileTemplateSchedule(templateId)
		sendJson(res, 200, { created: created.length, rundowns: created })
	})

	app.post('/api/rundowns/templates/:templateId/regenerate', async (req: Request, res: Response) => {
		const templateId = String(req.params.templateId).trim()
		const { result, error } = await regenerateFromTemplate(templateId)
		if (error) {
			sendJson(res, 400, { error: error.message })
			return
		}
		sendJson(res, 200, result)
	})
}
