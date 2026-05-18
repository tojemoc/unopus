import type { Application, Request, Response } from 'express'
import {
	createStoryTemplate,
	deleteStoryTemplate,
	importStoryTemplates,
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

function normalizeStoryPattern(
	pattern: unknown
): { ok: true; pattern: string[] } | { ok: false; error: string } {
	if (!Array.isArray(pattern) || pattern.length === 0) {
		return {
			ok: false,
			error: 'Pattern must be a non-empty array of part type IDs'
		}
	}
	const normalized: string[] = []
	for (const item of pattern) {
		if (typeof item !== 'string' || item.trim().length === 0) {
			return {
				ok: false,
				error: 'Each pattern entry must be a non-empty part type ID string'
			}
		}
		normalized.push(item.trim())
	}
	return { ok: true, pattern: normalized }
}

export function registerStoryRoutes(app: Application): void {
	app.get('/api/story-templates', (_req: Request, res: Response) => {
		sendJson(res, 200, { templates: listStoryTemplates() })
	})

	app.post('/api/story-templates/import', (req: Request, res: Response) => {
		const body = req.body as { templates?: unknown } | unknown
		const rawList = Array.isArray(body)
			? body
			: Array.isArray((body as { templates?: unknown }).templates)
				? (body as { templates: unknown[] }).templates
				: null

		if (!rawList) {
			sendJson(res, 400, {
				error: 'Body must be a JSON array of templates or { "templates": [...] }'
			})
			return
		}

		const normalized: Array<{ name: string; pattern: string[] }> = []
		for (const item of rawList) {
			if (typeof item !== 'object' || item === null) continue
			const entry = item as { name?: unknown; pattern?: unknown; storyPattern?: unknown }
			const name = typeof entry.name === 'string' ? entry.name.trim() : ''
			const patternRaw = entry.pattern ?? entry.storyPattern
			const patternResult = normalizeStoryPattern(patternRaw)
			if (!name || !patternResult.ok) continue
			normalized.push({ name, pattern: patternResult.pattern })
		}

		if (normalized.length === 0) {
			sendJson(res, 400, { error: 'No valid story templates found in import file' })
			return
		}

		const templates = importStoryTemplates(normalized)
		sendJson(res, 201, { templates, imported: templates.length })
	})

	app.post('/api/story-templates', (req: Request, res: Response) => {
		const body = req.body as MutationStoryTemplateCreate & { storyPattern?: string[] }
		const patternRaw = body.pattern ?? body.storyPattern
		if (!body.name?.trim()) {
			sendJson(res, 400, { error: 'Name is required' })
			return
		}
		const patternResult = normalizeStoryPattern(patternRaw)
		if (!patternResult.ok) {
			sendJson(res, 400, { error: patternResult.error })
			return
		}
		const template = createStoryTemplate({
			name: body.name.trim(),
			pattern: patternResult.pattern
		})
		sendJson(res, 201, { template })
	})

	app.patch('/api/story-templates/:id', (req: Request, res: Response) => {
		const body = req.body as Omit<MutationStoryTemplateUpdate, 'id'>
		let patch: Omit<MutationStoryTemplateUpdate, 'id'> = { ...body }

		if (body.name !== undefined) {
			const trimmedName = String(body.name).trim()
			if (!trimmedName) {
				sendJson(res, 400, { error: 'Name cannot be empty' })
				return
			}
			patch = { ...patch, name: trimmedName }
		}

		if (body.pattern !== undefined) {
			const patternResult = normalizeStoryPattern(body.pattern)
			if (!patternResult.ok) {
				sendJson(res, 400, { error: patternResult.error })
				return
			}
			patch = { ...patch, pattern: patternResult.pattern }
		}

		const updated = updateStoryTemplate(String(req.params.id), patch)
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
		const storyTemplateId = String(body.storyTemplateId ?? '').trim()
		if (!storyTemplateId) {
			sendJson(res, 400, { error: 'storyTemplateId is required' })
			return
		}
		const { result, error } = await quickAddStoryFromTemplate(String(req.params.segmentId), {
			...body,
			storyTemplateId
		})
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
		const targetSegmentId = String(body.targetSegmentId ?? '').trim()
		if (!targetSegmentId) {
			sendJson(res, 400, { error: 'targetSegmentId is required' })
			return
		}
		const { result, error } = await recallStoryToSegment(String(req.params.partId), {
			...body,
			targetSegmentId
		})
		if (error) {
			sendJson(res, 400, { error: error.message })
			return
		}
		sendJson(res, 201, { part: result?.part, pieces: result?.pieces })
	})

	app.post('/api/rundowns/generate-from-template', async (req: Request, res: Response) => {
		const body = req.body as {
			templateRundownId?: unknown
			scheduledDate?: unknown
		}
		const templateRundownId = String(body.templateRundownId ?? '').trim()
		const scheduledDateRaw = body.scheduledDate
		if (
			!templateRundownId ||
			scheduledDateRaw == null ||
			(typeof scheduledDateRaw === 'string' && scheduledDateRaw.trim() === '')
		) {
			sendJson(res, 400, { error: 'templateRundownId and scheduledDate are required' })
			return
		}
		const scheduledDate =
			typeof scheduledDateRaw === 'number' ? scheduledDateRaw : Number(scheduledDateRaw)
		const { result, error } = await generateRundownFromTemplate({
			templateRundownId,
			scheduledDate
		} satisfies GenerateRundownFromTemplateRequest)
		if (error) {
			sendJson(res, 400, { error: error.message })
			return
		}
		sendJson(res, 201, { rundown: result?.rundown })
	})
}
