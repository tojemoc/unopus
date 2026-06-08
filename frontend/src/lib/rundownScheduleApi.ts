import type { RegenerateFromTemplateResult, Rundown } from '~backend/background/interfaces'

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
			const parsed = JSON.parse(raw) as { error?: string }
			if (parsed.error) {
				message = parsed.error
			}
		} catch {
			// keep raw
		}
		throw new Error(message)
	}

	return (await response.json()) as T
}

export async function reconcileTemplateSchedule(templateId: string): Promise<Rundown[]> {
	const data = await request<{ rundowns: Rundown[] }>(
		`/api/rundowns/templates/${templateId}/reconcile`,
		{ method: 'POST' }
	)
	return data.rundowns ?? []
}

export async function regenerateFromTemplate(
	templateId: string
): Promise<RegenerateFromTemplateResult> {
	return request<RegenerateFromTemplateResult>(
		`/api/rundowns/templates/${templateId}/regenerate`,
		{ method: 'POST' }
	)
}
