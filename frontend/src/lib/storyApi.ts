import type {
	GenerateRundownFromTemplateRequest,
	MutationStoryTemplateCreate,
	MutationStoryTemplateUpdate,
	QuickAddStoryRequest,
	QuickAddStoryResult,
	Rundown,
	StoryLibraryEntry,
	StoryLibraryRecallRequest,
	StoryTemplate
} from '~backend/background/interfaces'
import type { Part, Piece } from '~backend/background/interfaces'

const apiBase = import.meta.env.MODE === 'development' ? '' : ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${apiBase}${path}`, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {})
		},
		...init
	})

	if (!response.ok) {
		const raw = await response.text()
		let message = raw || 'Request failed'
		try {
			const parsed = JSON.parse(raw) as { error?: string; message?: string }
			if (parsed.error) {
				message = parsed.error
			} else if (parsed.message) {
				message = parsed.message
			}
		} catch {
			// keep raw text
		}
		throw new Error(`HTTP ${response.status}: ${message}`)
	}

	return (await response.json()) as T
}

export async function fetchStoryTemplates(): Promise<StoryTemplate[]> {
	const data = await request<{ templates: StoryTemplate[] }>('/api/story-templates')
	return data.templates
}

export async function createStoryTemplate(
	payload: MutationStoryTemplateCreate
): Promise<StoryTemplate> {
	const data = await request<{ template: StoryTemplate }>('/api/story-templates', {
		method: 'POST',
		body: JSON.stringify(payload)
	})
	return data.template
}

export async function updateStoryTemplate(
	id: string,
	payload: Omit<MutationStoryTemplateUpdate, 'id'>
): Promise<StoryTemplate> {
	const data = await request<{ template: StoryTemplate }>(`/api/story-templates/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	})
	return data.template
}

export async function deleteStoryTemplate(id: string): Promise<void> {
	await request(`/api/story-templates/${id}`, { method: 'DELETE' })
}

export async function quickAddStory(
	segmentId: string,
	payload: QuickAddStoryRequest
): Promise<QuickAddStoryResult> {
	return request<QuickAddStoryResult>(`/api/segments/${segmentId}/quick-add-story`, {
		method: 'POST',
		body: JSON.stringify(payload)
	})
}

export async function searchStoryLibrary(
	q: string,
	limit = 50,
	offset = 0
): Promise<StoryLibraryEntry[]> {
	const params = new URLSearchParams({
		q,
		limit: String(limit),
		offset: String(offset)
	})
	const data = await request<{ results: StoryLibraryEntry[] }>(`/api/story-library?${params}`)
	return data.results
}

export async function recallStory(
	partId: string,
	payload: StoryLibraryRecallRequest
): Promise<{ part: Part; pieces: Piece[] }> {
	return request<{ part: Part; pieces: Piece[] }>(`/api/story-library/${partId}/recall`, {
		method: 'POST',
		body: JSON.stringify(payload)
	})
}

export async function generateRundownFromTemplate(
	payload: GenerateRundownFromTemplateRequest
): Promise<Rundown> {
	const data = await request<{ rundown: Rundown }>('/api/rundowns/generate-from-template', {
		method: 'POST',
		body: JSON.stringify(payload)
	})
	return data.rundown
}
