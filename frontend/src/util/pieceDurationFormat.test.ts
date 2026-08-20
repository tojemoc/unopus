import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { WIPE_CUT_POINT_SECONDS, formatSecondsPrecise } from './pieceDurationFormat.js'

describe('formatSecondsPrecise', () => {
	it('preserves wipe cut point hundredths (760ms → 0.76s, not 0.8s)', () => {
		assert.equal(formatSecondsPrecise(WIPE_CUT_POINT_SECONDS), '0.76s')
		assert.equal(formatSecondsPrecise(760 / 1000), '0.76s')
	})

	it('trims trailing zeros for whole or single-decimal values', () => {
		assert.equal(formatSecondsPrecise(2.5), '2.5s')
		assert.equal(formatSecondsPrecise(3), '3s')
	})
})
