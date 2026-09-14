import type { WeatherSyncResult } from '~backend/background/imeteo/types'

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

export async function syncWeatherFromImeteo(
	partId: string,
	day?: string
): Promise<WeatherSyncResult> {
	return request<WeatherSyncResult>('/api/weather/sync', {
		method: 'POST',
		body: JSON.stringify(day ? { partId, day } : { partId })
	})
}
