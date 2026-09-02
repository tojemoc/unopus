import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import fs from 'fs/promises'
import { resolveGfxTemplate } from '../background/gfxPreview'
import {
	ensureRundownMediaFolder,
	listRundownMedia,
	probeRelativeMediaDurationSeconds,
	resolveMediaAbsolutePath
} from '../background/media'
import { enrichMediaListingWithCoreReadiness } from '../background/mediaListingReadiness'

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
 * Registers the media API routes on the Express application.
 * Provides endpoints for listing, probing, and managing media files for rundowns.
 * @param app - The Express application instance.
 */
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
			const files = await enrichMediaListingWithCoreReadiness(rundownId, listing.files)
			res.json({ ...listing, files })
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})

	app.get('/api/media/file', async (req: Request, res: Response) => {
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
			const absolutePath = resolveMediaAbsolutePath(mediaPath)
			await fs.access(absolutePath)
			res.sendFile(absolutePath)
		} catch (error) {
			console.error(error)
			res.status(404).json({ error: 'Media file not found' })
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

	app.get('/api/gfx/template', (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		const template = typeof req.query.template === 'string' ? req.query.template.trim() : ''
		if (!template) {
			res.status(400).json({ error: 'Missing template query parameter' })
			return
		}

		const resolution = resolveGfxTemplate(template)
		if (!resolution) {
			res.status(404).json({ error: `GFX template not found: ${template}` })
			return
		}

		res.json(resolution)
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
			const files = await enrichMediaListingWithCoreReadiness(rundownId, listing.files)
			res.json({ ...listing, files })
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})
}
