import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import {
	generateDailyRundownIfNeeded,
	getDailyGenerationStatusForTemplate
} from '../background/api/dailyGeneration'
import { mutations as settingsMutations } from '../background/api/settings'
import { mutations as rundownMutations } from '../background/api/rundowns'

function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

export function registerDailyGenerationRoutes(app: Application): void {
	app.get('/api/daily-generation/status', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		const templateId =
			typeof req.query.templateId === 'string' ? req.query.templateId.trim() : ''
		if (!templateId) {
			res.status(400).json({ error: 'Missing templateId query parameter' })
			return
		}

		try {
			const status = await getDailyGenerationStatusForTemplate(templateId)
			res.json(status)
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})

	app.post('/api/daily-generation/generate', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		try {
			const { result: settings } = await settingsMutations.read()
			const bodyTemplateId =
				typeof req.body?.templateId === 'string' ? req.body.templateId.trim() : ''
			const templateId = bodyTemplateId || settings?.dailyTemplateRundownId?.trim()

			if (!templateId) {
				res.status(400).json({
					error:
						'No template specified — set dailyTemplateRundownId in settings or pass templateId'
				})
				return
			}

			// Manual override: force=true ignores dailyCloneTime.
			const result = await generateDailyRundownIfNeeded(templateId, {
				force: true,
				settings
			})

			if (!result) {
				res.status(400).json({ error: 'Daily generation did not run' })
				return
			}

			res.json(result)
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})

	/** Batch status for all template rundowns (used by the rundown list). */
	app.get('/api/daily-generation/statuses', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		try {
			const { result: rundowns, error } = await rundownMutations.read({})
			if (error) {
				res.status(400).json({ error: error.message })
				return
			}
			const list = Array.isArray(rundowns) ? rundowns : rundowns ? [rundowns] : []
			const templates = list.filter((rundown) => rundown.isTemplate)
			const statuses = await Promise.all(
				templates.map(async (template) => ({
					templateId: template.id,
					...(await getDailyGenerationStatusForTemplate(template.id))
				}))
			)
			res.json({ statuses })
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})
}
