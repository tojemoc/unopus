import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import { getIngestMediaRoot, getPreviewBaseUrl } from '../background/media'

/**
 * Retrieves the session user from the request's cookie.
 * @param req - The Express request object.
 * @returns The user object if found, undefined otherwise.
 */
function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

/**
 * Registers the configuration API routes on the Express application.
 * Provides an endpoint to retrieve application configuration such as preview base URL and ingest media root.
 * @param app - The Express application instance.
 */
export function registerConfigRoutes(app: Application): void {
	app.get('/api/config', (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		res.json({
			previewBaseUrl: getPreviewBaseUrl(),
			ingestMediaRoot: getIngestMediaRoot()
		})
	})
}
