import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clampToFieldMaxLength, resolveFieldMaxLength } from './payloadMaxLength.js'

describe('resolveFieldMaxLength', () => {
	it('returns undefined when unset or invalid', () => {
		assert.equal(resolveFieldMaxLength({ id: 'h', label: 'H', type: 'string' as never }), undefined)
		assert.equal(
			resolveFieldMaxLength({ id: 'h', label: 'H', type: 'string' as never, maxLength: 0 }),
			undefined
		)
		assert.equal(
			resolveFieldMaxLength({ id: 'h', label: 'H', type: 'string' as never, maxLength: -3 }),
			undefined
		)
		assert.equal(
			resolveFieldMaxLength({
				id: 'h',
				label: 'H',
				type: 'string' as never,
				maxLength: Number.NaN
			}),
			undefined
		)
	})

	it('floors positive values', () => {
		assert.equal(
			resolveFieldMaxLength({ id: 'h', label: 'H', type: 'string' as never, maxLength: 40 }),
			40
		)
		assert.equal(
			resolveFieldMaxLength({ id: 'h', label: 'H', type: 'string' as never, maxLength: 40.9 }),
			40
		)
	})
})

describe('clampToFieldMaxLength', () => {
	it('passes through when no limit', () => {
		assert.equal(
			clampToFieldMaxLength({ id: 'h', label: 'H', type: 'string' as never }, 'hello world'),
			'hello world'
		)
	})

	it('truncates to the configured limit', () => {
		assert.equal(
			clampToFieldMaxLength(
				{ id: 'h', label: 'H', type: 'string' as never, maxLength: 5 },
				'abcdefgh'
			),
			'abcde'
		)
		assert.equal(
			clampToFieldMaxLength({ id: 'h', label: 'H', type: 'string' as never, maxLength: 5 }, 'abcd'),
			'abcd'
		)
	})
})
