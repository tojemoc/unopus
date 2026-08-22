import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	countScriptCharacters,
	estimateScriptReadingSeconds,
	formatReadingClock,
	normalizeScriptCps,
	partUsesScriptDuration,
	resolveEffectiveScriptCps
} from './scriptReadingTime.js'

describe('scriptReadingTime', () => {
	it('counts collapsed whitespace characters', () => {
		assert.equal(countScriptCharacters('  hello   world \n\n '), 11)
		assert.equal(countScriptCharacters(''), 0)
		assert.equal(countScriptCharacters(undefined), 0)
	})

	it('estimates reading seconds with ceil and minimum 1s', () => {
		assert.equal(estimateScriptReadingSeconds('abcdefghij', 10), 1)
		assert.equal(estimateScriptReadingSeconds('a'.repeat(16), 15), 2)
		assert.equal(estimateScriptReadingSeconds('', 15), undefined)
	})

	it('clamps CPS and formats clock', () => {
		assert.equal(normalizeScriptCps(0), 15)
		assert.equal(normalizeScriptCps(100), 40)
		assert.equal(formatReadingClock(65), '01:05')
		assert.equal(formatReadingClock(0), '00:00')
	})

	it('identifies ILU family part types', () => {
		assert.equal(partUsesScriptDuration('ilu'), true)
		assert.equal(partUsesScriptDuration('doublebox'), true)
		assert.equal(partUsesScriptDuration('syn'), false)
	})

	it('resolves effective CPS from user profile then site default', () => {
		assert.equal(resolveEffectiveScriptCps(18, 15), 18)
		assert.equal(resolveEffectiveScriptCps(null, 20), 20)
		assert.equal(resolveEffectiveScriptCps(undefined, undefined), 15)
		assert.equal(resolveEffectiveScriptCps(0, 12), 12)
	})
})
