import type { Application, Request, Response } from 'express'
import {
	getEntityEdit,
	getEntityEditsForRundown,
	getUserFromSession,
	parseSessionCookie
} from '../background/auth/authStore'

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
 * Registers the edits API routes on the Express application.
 * Provides endpoints to retrieve edit history for entities.
 * @param app - The Express application instance.
 */
export function registerEditsRoutes(app: Application): void {
	app.get('/api/edits/rundown/:rundownId', (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}
		res.json({ edits: getEntityEditsForRundown(String(req.params.rundownId)) })
	})

	app.get('/api/edits/:entityType/:entityId', (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}
		const edit = getEntityEdit(String(req.params.entityType), String(req.params.entityId))
		res.json({ edit })
	})
}
