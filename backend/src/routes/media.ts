import type { Application, Request, Response } from 'express'
import { coreHandler } from '../background/coreHandler'
import { getVideoFileNameHistory, type MediaClipSummary } from '../background/mediaClipsHistory'

export type MediaClipsSource = 'core' | 'history'

export interface MediaClipsResponse {
	clips: MediaClipSummary[]
	source: MediaClipsSource
}

export function registerMediaRoutes(app: Application): void {
	app.get('/api/media/clips', (_req: Request, res: Response) => {
		const coreClips = coreHandler.getMediaObjects()
		if (coreClips !== null) {
			const response: MediaClipsResponse = {
				clips: coreClips,
				source: 'core'
			}
			res.json(response)
			return
		}

		const response: MediaClipsResponse = {
			clips: getVideoFileNameHistory(),
			source: 'history'
		}
		res.json(response)
	})
}
