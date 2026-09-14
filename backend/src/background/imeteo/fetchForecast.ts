import type { ImeteoForecastDay, ImeteoForecastResponse } from './types.js'

export const IMETEO_FORECAST_URL = 'https://www.imeteo.sk/api/v1/partners/forecast'

/** Stable message when the Partner API cannot be reached (network / redirect failure). */
export const IMETEO_UNAVAILABLE_ERROR = 'iMeteo forecast service is unavailable'

const DEFAULT_DAY: ImeteoForecastDay = 'tomorrow'

export function normalizeForecastDay(day: string | undefined | null): string {
	const trimmed = day?.trim()
	return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DAY
}

function isForecastShape(value: unknown): value is ImeteoForecastResponse {
	if (!value || typeof value !== 'object') return false
	const obj = value as Record<string, unknown>
	if (typeof obj.date !== 'string' || typeof obj.forecastText !== 'string') return false
	if (!Array.isArray(obj.cities)) return false
	// Reject malformed city rows before mapForecast / resolveCityMeta touch them.
	return obj.cities.every(
		(city) =>
			city !== null &&
			typeof city === 'object' &&
			typeof (city as Record<string, unknown>).name === 'string'
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
	let response: Response
	try {
		response = await fetchImpl(url, {
			method: 'GET',
			// Do not follow redirects while the API key is in the request headers.
			redirect: 'error',
			headers: {
				'X-API-KEY': apiKey,
				Accept: 'application/json'
			}
		})
	} catch {
		throw new Error(IMETEO_UNAVAILABLE_ERROR)
	}

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
