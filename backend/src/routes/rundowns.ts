import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import { db } from '../background/db'
import type { RundownStats } from '../background/interfaces'

function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

function countByRundown(table: 'segments' | 'parts' | 'pieces'): Map<string, number> {
	const rows = db
		.prepare(`SELECT rundownId, COUNT(*) AS count FROM ${table} GROUP BY rundownId`)
		.all() as { rundownId: string; count: number }[]

	return new Map(rows.map((row) => [row.rundownId, row.count]))
}

/**
 * Registers rundown-related API routes on the Express application.
 * @param app - The Express application instance.
 */
export function registerRundownsRoutes(app: Application): void {
	app.get('/api/rundowns/stats', (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		try {
			const segmentCounts = countByRundown('segments')
			const partCounts = countByRundown('parts')
			const pieceCounts = countByRundown('pieces')

			const rundownIds = new Set([
				...segmentCounts.keys(),
				...partCounts.keys(),
				...pieceCounts.keys()
			])

			const stats: Record<string, RundownStats> = {}
			for (const rundownId of rundownIds) {
				stats[rundownId] = {
					segmentCount: segmentCounts.get(rundownId) ?? 0,
					partCount: partCounts.get(rundownId) ?? 0,
					pieceCount: pieceCounts.get(rundownId) ?? 0
				}
			}

			res.json({ stats })
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})
}
