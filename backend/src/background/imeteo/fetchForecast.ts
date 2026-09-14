import type { ImeteoForecastDay, ImeteoForecastResponse } from './types.js'

export const IMETEO_FORECAST_URL = 'https://www.imeteo.sk/api/v1/partners/forecast'

const DEFAULT_DAY: ImeteoForecastDay = 'tomorrow'

export function normalizeForecastDay(day: string | undefined | null): string {
	const trimmed = day?.trim()
	return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DAY
}

function isForecastShape(value: unknown): value is ImeteoForecastResponse {
	if (!value || typeof value !== 'object') return false
	const obj = value as Record<string, unknown>
	return (
		typeof obj.date === 'string' &&
		typeof obj.forecastText === 'string' &&
		Array.isArray(obj.cities)
	)
}

/**
 * Fetch national forecast from iMeteo Partner API.
 * Auth: HTTP header `X-API-KEY` only (per partner PDF).
 */
export async function fetchImeteoForecast(options: {
	apiKey: string
	day?: string | null
	fetchImpl?: typeof fetch
}): Promise<ImeteoForecastResponse> {
	const apiKey = options.apiKey.trim()
	if (!apiKey) {
		throw new Error('iMeteo API key is not configured — set it under Settings → Connection')
	}

	const day = normalizeForecastDay(options.day)
	const url = new URL(IMETEO_FORECAST_URL)
	url.searchParams.set('day', day)

	const fetchImpl = options.fetchImpl ?? fetch
	const response = await fetchImpl(url, {
		method: 'GET',
		headers: {
			'X-API-KEY': apiKey,
			Accept: 'application/json'
		}
	})

	if (response.status === 401 || response.status === 403) {
		throw new Error('iMeteo rejected the API key (401/403) — check Settings → Connection')
	}

	if (!response.ok) {
		throw new Error(`iMeteo forecast request failed (HTTP ${response.status})`)
	}

	let body: unknown
	try {
		body = await response.json()
	} catch {
		throw new Error('iMeteo returned a non-JSON forecast response')
	}

	if (!isForecastShape(body)) {
		throw new Error('iMeteo forecast response is missing required fields')
	}

	return body
}
