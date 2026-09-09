import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatPayloadStringValue, normalizeStringTypedPayload } from './payloadStringValue.js'

describe('formatPayloadStringValue', () => {
	it('keeps plain strings', () => {
		assert.equal(formatPayloadStringValue('hello'), 'hello')
	})

	it('stringifies city arrays as JSON (not [object Object])', () => {
		const cities = [
			{ region: 'BA', name: 'BRATISLAVA', temp: '4' },
			{ region: 'KE', name: 'KOŠICE', temp: '2' }
		]
		assert.equal(formatPayloadStringValue(cities), JSON.stringify(cities))
		assert.equal(String(cities).includes('[object Object]'), true)
	})

	it('maps nullish to empty string', () => {
		assert.equal(formatPayloadStringValue(undefined), '')
		assert.equal(formatPayloadStringValue(null), '')
	})
})

describe('normalizeStringTypedPayload', () => {
	it('converts non-string values for declared string fields only', () => {
		const normalized = normalizeStringTypedPayload(
			{
				cities: [{ region: 'BA', name: 'BRATISLAVA', temp: '4' }],
				bypass: true,
				name: 'keep'
			},
			['cities', 'name']
		)
		assert.equal(
			normalized.cities,
			'[{"region":"BA","name":"BRATISLAVA","temp":"4"}]'
		)
		assert.equal(normalized.bypass, true)
		assert.equal(normalized.name, 'keep')
	})
})
