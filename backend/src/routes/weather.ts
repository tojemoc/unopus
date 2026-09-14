import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import { syncWeatherPartFromImeteo } from '../background/imeteo/syncWeatherPart'

function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

function statusForError(error: unknown): number {
	const msg = error instanceof Error ? error.message : String(error)
	if (/not authenticated/i.test(msg)) return 401
	if (/API key|rejected the API key/i.test(msg)) return 400
	if (/not found|no weather piece|Missing partId|no recognisable/i.test(msg)) return 400
	if (/HTTP 5/i.test(msg)) return 502
	return 500
}

/**
 * Weather / iMeteo Partner API routes.
 */
export function registerWeatherRoutes(app: Application): void {
	app.post('/api/weather/sync', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		const partId = typeof req.body?.partId === 'string' ? req.body.partId.trim() : ''
		const day =
			typeof req.body?.day === 'string' && req.body.day.trim() ? req.body.day.trim() : undefined

		if (!partId) {
			res.status(400).json({ error: 'Missing partId' })
			return
		}

		try {
			const result = await syncWeatherPartFromImeteo({ partId, day })
			res.json(result)
		} catch (error) {
			console.error(error)
			res.status(statusForError(error)).json({
				error: error instanceof Error ? error.message : String(error)
			})
		}
	})
}
