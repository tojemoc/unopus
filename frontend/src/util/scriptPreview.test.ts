import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { firstScriptLine } from './scriptPreview.js'

describe('firstScriptLine', () => {
	it('returns empty string for missing script', () => {
		assert.equal(firstScriptLine(undefined), '')
		assert.equal(firstScriptLine('   '), '')
	})

	it('collapses whitespace into a single line', () => {
		assert.equal(firstScriptLine('Osobné  údaje\n v OR SR.'), 'Osobné údaje v OR SR.')
	})

	it('truncates long copy with an ellipsis', () => {
		const long = 'A'.repeat(200)
		const excerpt = firstScriptLine(long, 20)
		assert.equal(excerpt.endsWith('…'), true)
		assert.ok(excerpt.length <= 20)
	})
})
