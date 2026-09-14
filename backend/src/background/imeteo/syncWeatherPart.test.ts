import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { db } from '../db.js'
import { mutations as piecesMutations } from '../api/pieces.js'
import { mutations as partsMutations } from '../api/parts.js'
import { syncWeatherPartFromImeteo } from './syncWeatherPart.js'

const rundownId = 'imeteo-sync-test-rundown'
const segmentId = 'imeteo-sync-test-segment'
const partId = 'imeteo-sync-test-part'
const pieceId = 'imeteo-sync-test-piece'

const forecastBody = {
	date: '2026-09-01',
	day: 'tomorrow',
	forecastText: 'Prevažne polooblačno na celom území.',
	slovakia: {
		tempMin: 8,
		tempMax: 27,
		status: { name: 'Prehánky', icon: 'storm' }
	},
	cities: [
		{
			name: 'Bratislava',
			tempMin: 18,
			tempMax: 27,
			temp: 27,
			status: { name: 'Polooblačno', icon: 'cloudy' }
		},
		{
			name: 'Košice',
			tempMin: 14,
			tempMax: 23,
			temp: 23,
			status: { name: 'Dážď', icon: 'rain' }
		}
	]
}

function seedFixture(): void {
	db.prepare(`INSERT OR REPLACE INTO settings (id, document) VALUES ('settings', ?)`).run(
		JSON.stringify({
			imeteoApiKey: 'test-key',
			imeteoForecastDay: 'tomorrow'
		})
	)
	db.prepare(
		`INSERT OR REPLACE INTO rundowns (id, playlistId, document) VALUES (?, NULL, ?)`
	).run(rundownId, JSON.stringify({ name: 'weather-sync', sync: false }))
	db.prepare(
		`INSERT OR REPLACE INTO segments (id, playlistId, rundownId, document) VALUES (?, NULL, ?, ?)`
	).run(segmentId, rundownId, JSON.stringify({ name: 'seg', rank: 0 }))
	db.prepare(
		`INSERT OR REPLACE INTO parts (id, playlistId, rundownId, segmentId, document) VALUES (?, NULL, ?, ?, ?)`
	).run(
		partId,
		rundownId,
		segmentId,
		JSON.stringify({
			name: 'Počasie',
			rank: 0,
			partType: 'weather',
			script: 'old script'
		})
	)
	db.prepare(
		`INSERT OR REPLACE INTO pieces (id, playlistId, rundownId, segmentId, partId, document) VALUES (?, NULL, ?, ?, ?, ?)`
	).run(
		pieceId,
		rundownId,
		segmentId,
		partId,
		JSON.stringify({
			name: 'Weather',
			pieceType: 'weather',
			rank: 0,
			payload: { cities: '[]' }
		})
	)
}

function cleanupFixture(): void {
	db.prepare(`DELETE FROM pieces WHERE id = ?`).run(pieceId)
	db.prepare(`DELETE FROM parts WHERE id = ?`).run(partId)
	db.prepare(`DELETE FROM segments WHERE id = ?`).run(segmentId)
	db.prepare(`DELETE FROM rundowns WHERE id = ?`).run(rundownId)
}

describe('syncWeatherPartFromImeteo', () => {
	beforeEach(() => {
		cleanupFixture()
		seedFixture()
	})

	afterEach(() => {
		cleanupFixture()
	})

	it('persists piece + part in one commit and returns success when Sofie push completes', async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response(JSON.stringify(forecastBody), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})

		let pushedPartId: string | undefined
		const result = await syncWeatherPartFromImeteo({
			partId,
			fetchImpl,
			sendPartUpdate: async (id) => {
				pushedPartId = id
			}
		})

		assert.equal(result.partId, partId)
		assert.equal(result.pieceId, pieceId)
		assert.equal(result.forecastText, forecastBody.forecastText)
		assert.equal(pushedPartId, partId)

		const { result: piece } = await piecesMutations.readOne(pieceId)
		const { result: part } = await partsMutations.readOne(partId)
		assert.ok(piece)
		assert.ok(part)
		assert.equal(part.script, forecastBody.forecastText)
		const cities = JSON.parse(String(piece.payload?.cities ?? '[]')) as { region: string }[]
		assert.ok(cities.some((c) => c.region === 'BA'))
		assert.ok(cities.some((c) => c.region === 'KE'))
	})

	it('propagates Sofie push failure after persistence (no successful WeatherSyncResult)', async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response(JSON.stringify(forecastBody), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})

		await assert.rejects(
			() =>
				syncWeatherPartFromImeteo({
					partId,
					fetchImpl,
					sendPartUpdate: async () => {
						throw new Error('Sofie core unreachable')
					}
				}),
			/Sofie core unreachable/
		)

		// Local rows still committed before the push attempt.
		const { result: part } = await partsMutations.readOne(partId)
		assert.equal(part?.script, forecastBody.forecastText)
	})
})
