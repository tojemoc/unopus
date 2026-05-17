import type { Application, Request, Response } from 'express'
import {
	createStoryTemplate,
	deleteStoryTemplate,
	generateRundownFromTemplate,
	listStoryTemplates,
	quickAddStoryFromTemplate,
	recallStoryToSegment,
	searchStoryLibrary,
	updateStoryTemplate
} from '../background/storyComposer'
import type {
	GenerateRundownFromTemplateRequest,
	MutationStoryTemplateCreate,
	MutationStoryTemplateUpdate,
	QuickAddStoryRequest,
	StoryLibraryRecallRequest
} from '../background/interfaces'

function sendJson(res: Response, status: number, body: unknown): void {
	res.status(status).json(body)
}

export function registerStoryRoutes(app: Application): void {
	app.get('/api/story-templates', (_req: Request, res: Response) => {
		sendJson(res, 200, { templates: listStoryTemplates() })
	})

	app.post('/api/story-templates', (req: Request, res: Response) => {
		const body = req.body as MutationStoryTemplateCreate & { storyPattern?: string[] }
		const pattern = body.pattern ?? body.storyPattern
		if (!body.name?.trim()) {
			sendJson(res, 400, { error: 'Name is required' })
			return
		}
		if (!Array.isArray(pattern) || pattern.length === 0) {
			sendJson(res, 400, { error: 'Pattern must be a non-empty array of part type IDs' })
			return
		}
		const template = createStoryTemplate({
			name: body.name.trim(),
			pattern
		})
		sendJson(res, 201, { template })
	})

	app.patch('/api/story-templates/:id', (req: Request, res: Response) => {
		const body = req.body as Omit<MutationStoryTemplateUpdate, 'id'>
		const updated = updateStoryTemplate(String(req.params.id), body)
		if (!updated) {
			sendJson(res, 404, { error: 'Story template not found' })
			return
		}
		sendJson(res, 200, { template: updated })
	})

	app.delete('/api/story-templates/:id', (req: Request, res: Response) => {
		const deleted = deleteStoryTemplate(String(req.params.id))
		if (!deleted) {
			sendJson(res, 404, { error: 'Story template not found' })
			return
		}
		sendJson(res, 200, { ok: true })
	})

	app.post('/api/segments/:segmentId/quick-add-story', async (req: Request, res: Response) => {
		const body = req.body as QuickAddStoryRequest
		if (!body.storyTemplateId) {
			sendJson(res, 400, { error: 'storyTemplateId is required' })
			return
		}
		const { result, error } = await quickAddStoryFromTemplate(String(req.params.segmentId), body)
		if (error) {
			sendJson(res, 400, { error: error.message })
			return
		}
		sendJson(res, 201, result)
	})

	app.get('/api/story-library', (req: Request, res: Response) => {
		const q = typeof req.query.q === 'string' ? req.query.q : ''
		const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100)
		const offset = Math.max(Number(req.query.offset) || 0, 0)
		const results = searchStoryLibrary(q, limit, offset)
		sendJson(res, 200, { results })
	})

	app.post('/api/story-library/:partId/recall', async (req: Request, res: Response) => {
		const body = req.body as StoryLibraryRecallRequest
		if (!body.targetSegmentId) {
			sendJson(res, 400, { error: 'targetSegmentId is required' })
			return
		}
		const { result, error } = await recallStoryToSegment(String(req.params.partId), body)
		if (error) {
			sendJson(res, 400, { error: error.message })
			return
		}
		sendJson(res, 201, { part: result?.part, pieces: result?.pieces })
	})

	app.post('/api/rundowns/generate-from-template', async (req: Request, res: Response) => {
		const body = req.body as GenerateRundownFromTemplateRequest
		if (!body.templateRundownId || body.scheduledDate === undefined) {
			sendJson(res, 400, { error: 'templateRundownId and scheduledDate are required' })
			return
		}
		const { result, error } = await generateRundownFromTemplate(body)
		if (error) {
			sendJson(res, 400, { error: error.message })
			return
		}
		sendJson(res, 201, { rundown: result?.rundown })
	})
}
