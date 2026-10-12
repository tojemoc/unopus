import type { Application, Request, Response } from 'express'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import { fetchCorePartSettingsForRundown, lastPartIngestForAutoNext } from '../background/autoNextState'
import { mutations as partMutations } from '../background/api/parts'
import { mutations as rundownMutations } from '../background/api/rundowns'

function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

export function registerAutoNextStateRoutes(app: Application): void {
	app.get('/api/rundowns/:rundownId/auto-next-state', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		const rundownId = String(req.params.rundownId)
		try {
			const { result, error } = await rundownMutations.read({ id: rundownId })
			if (error) {
				throw error
			}
			const rundown = Array.isArray(result) ? result[0] : result
			if (!rundown) {
				res.status(404).json({ error: 'Rundown not found' })
				return
			}

			if (!rundown.sync || rundown.isTemplate) {
				res.json({
					rundownId,
					source: 'not-synced',
					parts: [],
					checkedAt: new Date().toISOString()
				})
				return
			}

			const { result: partsResult, error: partsError } = await partMutations.read({ rundownId })
			if (partsError) {
				throw partsError
			}
			const localParts = Array.isArray(partsResult) ? partsResult : partsResult ? [partsResult] : []
			const coreResult = await fetchCorePartSettingsForRundown(rundownId)
			if (coreResult.source !== 'core') {
				res.json({
					rundownId,
					source: coreResult.source,
					parts: [],
					checkedAt: new Date().toISOString(),
					...(coreResult.source === 'core-error' ? { error: coreResult.error } : {})
				})
				return
			}

			const corePartsByExternalId = new Map(
				coreResult.parts.map((part) => [part.partExternalId, part])
			)
			res.json({
				rundownId,
				source: 'core',
				parts: localParts.map((part) => {
					const corePart = corePartsByExternalId.get(part.id)
					const lastIngestAt = lastPartIngestForAutoNext(rundownId, part.id)
					return {
						partExternalId: part.id,
						...(corePart
							? {
									autoNext: corePart.autoNext,
									expectedDuration: corePart.expectedDuration,
									...(corePart.autoNextSource
										? { autoNextSource: corePart.autoNextSource }
										: {})
								}
							: {}),
						...(lastIngestAt !== undefined ? { lastIngestAt } : {})
					}
				}),
				checkedAt: new Date().toISOString()
			})
		} catch (error) {
			console.error('Failed to read rundown AUTO state:', error)
			res.status(500).json({ error: 'Could not read AUTO state from Sofie' })
		}
	})
}
