import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import { getPreviewBaseUrl } from '../background/media'

function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

export function registerConfigRoutes(app: Application): void {
	app.get('/api/config', (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		res.json({
			previewBaseUrl: getPreviewBaseUrl()
		})
	})
}
