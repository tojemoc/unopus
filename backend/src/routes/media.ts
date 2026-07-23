import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import {
	ensureRundownMediaFolder,
	listRundownMedia,
	probeRelativeMediaDurationSeconds
} from '../background/media'

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
			const listing = await listRundownMedia(rundownId, subdir)
			res.json(listing)
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})

	app.get('/api/media/duration', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		const mediaPath = typeof req.query.path === 'string' ? req.query.path.trim() : ''
		if (!mediaPath) {
			res.status(400).json({ error: 'Missing path query parameter' })
			return
		}

		try {
			const durationSeconds = await probeRelativeMediaDurationSeconds(mediaPath)
			res.json({ path: mediaPath, durationSeconds: durationSeconds ?? null })
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})

	app.post('/api/rundowns/:rundownId/media/ensure-folder', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		const rundownId = String(req.params.rundownId)
		const subdir =
			typeof req.body?.subdir === 'string'
				? req.body.subdir
				: typeof req.query.subdir === 'string'
					? req.query.subdir
					: 'clips'

		try {
			const listing = await ensureRundownMediaFolder(rundownId, subdir)
			res.json(listing)
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})
}
