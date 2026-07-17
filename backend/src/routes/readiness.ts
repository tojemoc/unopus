import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import { fetchCoreContentStatusForRundown } from '../background/coreContentStatus'
import { evaluateRundownReadiness } from '../background/mediaReadiness'
import { mutations as piecesMutations } from '../background/api/pieces'
import { mutations as typeManifestMutations } from '../background/api/typeManifests'
import { TypeManifestEntity } from '../background/interfaces'

function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

export function registerReadinessRoutes(app: Application): void {
	app.get('/api/rundowns/:rundownId/readiness', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		const rundownId = String(req.params.rundownId)

		try {
			const { result: piecesResult, error: piecesError } = await piecesMutations.read({ rundownId })
			if (piecesError) {
				throw piecesError
			}

			const { result: manifestsResult, error: manifestsError } = await typeManifestMutations.read({})
			if (manifestsError) {
				throw manifestsError
			}

			const pieces = Array.isArray(piecesResult)
				? piecesResult
				: piecesResult
					? [piecesResult]
					: []
			const manifests = Array.isArray(manifestsResult)
				? manifestsResult
				: manifestsResult
					? [manifestsResult]
					: []

			const pieceManifests = manifests.filter(
				(manifest) => manifest.entityType === TypeManifestEntity.Piece
			)

			const coreStatuses = await fetchCoreContentStatusForRundown(rundownId)
			const readiness = await evaluateRundownReadiness(
				pieces,
				pieceManifests,
				coreStatuses ?? undefined
			)
			res.json(readiness)
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})
}
