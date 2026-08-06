import type { DailyGenerationResult, DailyGenerationStatusResult } from '~backend/background/interfaces'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {})
		},
		...init
	})

	if (!response.ok) {
		let message = `Request failed (${response.status})`
		try {
			const body: unknown = await response.json()
			if (body && typeof body === 'object' && 'error' in body) {
				const errorField = (body as { error?: unknown }).error
				if (typeof errorField === 'string' && errorField.trim()) {
					message = errorField
				}
			}
		} catch {
			// Non-JSON error body — keep status-based message.
		}
		throw new Error(message)
	}

	const body: unknown = await response.json()
	if (body && typeof body === 'object' && 'error' in body) {
		const errorField = (body as { error?: unknown }).error
		if (typeof errorField === 'string' && errorField.trim()) {
			throw new Error(errorField)
		}
	}
	return body as T
}

export type TemplateDailyStatus = DailyGenerationStatusResult & { templateId: string }

export async function fetchDailyGenerationStatuses(): Promise<TemplateDailyStatus[]> {
	const data = await request<{ statuses: TemplateDailyStatus[] }>('/api/daily-generation/statuses')
	return data.statuses
}

export async function fetchDailyGenerationStatus(
	templateId: string
): Promise<DailyGenerationStatusResult> {
	const params = new URLSearchParams({ templateId })
	return request<DailyGenerationStatusResult>(`/api/daily-generation/status?${params}`)
}

export async function generateDailyRundownNow(templateId?: string): Promise<DailyGenerationResult> {
	return request<DailyGenerationResult>('/api/daily-generation/generate', {
		method: 'POST',
		body: JSON.stringify(templateId ? { templateId } : {})
	})
}
