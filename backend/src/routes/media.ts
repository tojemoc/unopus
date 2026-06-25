import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import { listRundownMedia } from '../background/media'

function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

export function registerMediaRoutes(app: Application): void {
	app.get('/api/rundowns/:rundownId/media', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		const rundownId = String(req.params.rundownId)
		const subdir = typeof req.query.subdir === 'string' ? req.query.subdir : 'clips'

		try {
			const files = await listRundownMedia(rundownId, subdir)
			res.json({ files })
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})
}
