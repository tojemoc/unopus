import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import {
	generateDailyRundownIfNeeded,
	getDailyGenerationStatusForTemplate
} from '../background/api/dailyGeneration'
import { mutations as settingsMutations } from '../background/api/settings'
import { mutations as rundownMutations } from '../background/api/rundowns'

/**
 * Retrieves the session user from the request's cookie.
 * @param req - The Express request object.
 * @returns The user object if found, null otherwise.
 */
function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

/**
 * Determines the appropriate HTTP status code based on the error message.
 * @param error - The error object or message.
 * @returns The HTTP status code (409, 400, or 500).
 */
function statusForError(error: unknown): number {
	const msg = error instanceof Error ? error.message : String(error)
	if (/still in progress/i.test(msg)) return 409
	if (/not found|not a template|Invalid dailyClone|No template|Missing templateId|did not run/i.test(msg))
		return 400
	return 500
}

/**
 * Registers the daily generation API routes on the Express application.
 * Provides endpoints for generating daily rundowns from templates and checking generation status.
 * @param app - The Express application instance.
 */
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
			res.status(statusForError(error)).json({
				error: error instanceof Error ? error.message : String(error)
			})
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
			res.status(statusForError(error)).json({
				error: error instanceof Error ? error.message : String(error)
			})
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
			res.status(statusForError(error)).json({
				error: error instanceof Error ? error.message : String(error)
			})
		}
	})
}
