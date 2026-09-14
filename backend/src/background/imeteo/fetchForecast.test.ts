import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	fetchImeteoForecast,
	IMETEO_FORECAST_URL,
	IMETEO_UNAVAILABLE_ERROR,
	normalizeForecastDay
} from './fetchForecast.js'

function jsonResponse(body: unknown, init?: { status?: number }): Response {
	return new Response(JSON.stringify(body), {
		status: init?.status ?? 200,
		headers: { 'Content-Type': 'application/json' }
	})
}

const validCity = {
	name: 'Bratislava',
	tempMin: 10,
	tempMax: 20,
	temp: 18,
	status: { name: 'Jasno', icon: 'sunny' }
}

const validBody = {
	date: '2026-09-01',
	day: 'tomorrow',
	forecastText: 'Polooblačno.',
	slovakia: { tempMin: 8, tempMax: 27, status: { name: 'Ok', icon: 'cloudy' } },
	cities: [validCity]
}

describe('normalizeForecastDay', () => {
	it('defaults empty/null to tomorrow', () => {
		assert.equal(normalizeForecastDay(undefined), 'tomorrow')
		assert.equal(normalizeForecastDay(null), 'tomorrow')
		assert.equal(normalizeForecastDay(''), 'tomorrow')
		assert.equal(normalizeForecastDay('  '), 'tomorrow')
		assert.equal(normalizeForecastDay('today'), 'today')
	})
})

describe('fetchImeteoForecast', () => {
	it('rejects cities entries without a string name (e.g. cities: [{}])', async () => {
		const fetchImpl: typeof fetch = async () =>
			jsonResponse({
				...validBody,
				cities: [{}]
			})

		await assert.rejects(
			() => fetchImeteoForecast({ apiKey: 'secret', fetchImpl }),
			(err: unknown) => {
				assert.ok(err instanceof Error)
				assert.match(err.message, /missing required fields/i)
				return true
			}
		)
	})

	it('accepts a well-formed forecast body', async () => {
		const fetchImpl: typeof fetch = async () => jsonResponse(validBody)
		const result = await fetchImeteoForecast({ apiKey: 'secret', fetchImpl })
		assert.equal(result.date, '2026-09-01')
		assert.equal(result.cities[0]?.name, 'Bratislava')
	})

	it('sends GET with X-API-KEY and redirect: error', async () => {
		let seenUrl: string | URL | Request | undefined
		let seenInit: RequestInit | undefined

		const fetchImpl: typeof fetch = async (input, init) => {
			seenUrl = input
			seenInit = init
			return jsonResponse(validBody)
		}

		await fetchImeteoForecast({ apiKey: 'partner-key', day: 'today', fetchImpl })

		const url = String(seenUrl)
		assert.ok(url.startsWith(IMETEO_FORECAST_URL))
		assert.ok(url.includes('day=today'))
		assert.equal(seenInit?.method, 'GET')
		assert.equal(seenInit?.redirect, 'error')
		const headers = new Headers(seenInit?.headers)
		assert.equal(headers.get('X-API-KEY'), 'partner-key')
		assert.equal(headers.get('Accept'), 'application/json')
	})

	it('maps network rejections to the stable availability error', async () => {
		const fetchImpl: typeof fetch = async () => {
			throw new Error('getaddrinfo ENOTFOUND www.imeteo.sk')
		}

		await assert.rejects(
			() => fetchImeteoForecast({ apiKey: 'secret', fetchImpl }),
			(err: unknown) => {
				assert.ok(err instanceof Error)
				assert.equal(err.message, IMETEO_UNAVAILABLE_ERROR)
				return true
			}
		)
	})

	it('still surfaces HTTP status errors from returned responses', async () => {
		const fetchImpl: typeof fetch = async () => jsonResponse({ error: 'nope' }, { status: 502 })

		await assert.rejects(
			() => fetchImeteoForecast({ apiKey: 'secret', fetchImpl }),
			(err: unknown) => {
				assert.ok(err instanceof Error)
				assert.match(err.message, /HTTP 502/)
				return true
			}
		)
	})

	it('rejects missing API key before calling fetch', async () => {
		let called = false
		const fetchImpl: typeof fetch = async () => {
			called = true
			return jsonResponse(validBody)
		}

		await assert.rejects(
			() => fetchImeteoForecast({ apiKey: '  ', fetchImpl }),
			/not configured/i
		)
		assert.equal(called, false)
	})
})
