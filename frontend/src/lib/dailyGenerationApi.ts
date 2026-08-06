import type { DailyGenerationResult, DailyGenerationStatusResult } from '~backend/background/interfaces'

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
	const body = (await response.json()) as T & { error?: string }
	if (!response.ok) {
		throw new Error('error' in body && body.error ? body.error : 'Request failed')
	}
	return body
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
