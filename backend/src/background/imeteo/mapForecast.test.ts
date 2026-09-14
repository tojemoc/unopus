import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	citiesToJson,
	mapCityToWeatherPayload,
	mapForecastToWeatherCities,
	mapImeteoIconToGfx,
	pickDisplayTemp
} from './mapForecast.js'
import type { ImeteoForecastResponse } from './types.js'

const sampleForecast: ImeteoForecastResponse = {
	date: '2026-09-01',
	day: 'tomorrow',
	forecastText:
		'Prevažne polooblačno, prechodne aj menej oblačnosti. Popoludní na západe a severozápade pribúdanie oblačnosti a prehánky alebo búrky.',
	slovakia: {
		tempMin: 8,
		tempMax: 27,
		status: { name: 'Prehánky, búrky', icon: 'storm' }
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
			name: 'Trnava',
			tempMin: 16,
			tempMax: 27,
			temp: 27,
			status: { name: 'Skoro jasno', icon: 'sunny' }
		},
		{
			name: 'Nitra',
			tempMin: 15,
			tempMax: 26,
			temp: 26,
			status: { name: 'Polooblačno', icon: 'mostly-cloudy' }
		},
		{
			name: 'Trenčín',
			tempMin: 14,
			tempMax: 25,
			temp: 25,
			status: { name: 'Búrka', icon: 'storm' }
		},
		{
			name: 'Žilina',
			tempMin: 12,
			tempMax: 22,
			temp: 22,
			status: { name: 'Sneženie', icon: 'snow' }
		},
		{
			name: 'Banská Bystrica',
			tempMin: 13,
			tempMax: 24,
			temp: 24,
			status: { name: 'Oblačno', icon: 'overcast' }
		},
		{
			name: 'Košice',
			tempMin: 14,
			tempMax: 23,
			temp: 23,
			status: { name: 'Dážď', icon: 'rain' }
		},
		{
			name: 'Prešov',
			tempMin: 13,
			tempMax: 22,
			temp: 22,
			status: { name: 'Prehánky', icon: 'showers' }
		}
	]
}

describe('mapImeteoIconToGfx', () => {
	it('maps partner icons onto available Caspar SVG stems', () => {
		assert.equal(mapImeteoIconToGfx('sunny'), 'sunny')
		assert.equal(mapImeteoIconToGfx('mostly-cloudy'), 'partly-cloudy')
		assert.equal(mapImeteoIconToGfx('storm'), 'rain')
		assert.equal(mapImeteoIconToGfx('heavy-snow'), 'snow')
		assert.equal(mapImeteoIconToGfx('unknown-icon'), 'cloudy')
	})
})

describe('pickDisplayTemp', () => {
	it('prefers tempMax for the map card', () => {
		assert.equal(pickDisplayTemp({ temp: 20, tempMax: 27 }), '27')
	})
})

describe('mapForecastToWeatherCities', () => {
	it('emits GFX-compatible cities in BA…PO order', () => {
		const cities = mapForecastToWeatherCities(sampleForecast)
		assert.equal(cities.length, 8)
		assert.deepEqual(
			cities.map((c) => c.region),
			['BA', 'TT', 'NR', 'TN', 'ZA', 'BB', 'KE', 'PO']
		)
		assert.equal(cities[0]?.name, 'BRATISLAVA')
		assert.equal(cities[0]?.temp, '27')
		assert.equal(cities[0]?.image, 'cloudy')
		assert.equal(cities[2]?.image, 'partly-cloudy')
		assert.equal(cities[3]?.image, 'rain')
		assert.equal(cities[5]?.name, 'B. BYSTRICA')
		assert.equal(cities[5]?.image, 'cloudy')

		const parsed = JSON.parse(citiesToJson(cities)) as unknown
		assert.ok(Array.isArray(parsed))
		assert.equal((parsed as { region: string }[])[0]?.region, 'BA')
	})

	it('skips unknown city names', () => {
		const row = mapCityToWeatherPayload({
			name: 'Somewhere Else',
			tempMin: 1,
			tempMax: 2,
			temp: 2,
			status: { name: 'Jasno', icon: 'sunny' }
		})
		assert.equal(row, undefined)
	})
})
