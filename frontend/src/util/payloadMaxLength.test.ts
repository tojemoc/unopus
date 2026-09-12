import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	clampToFieldMaxLength,
	findPayloadMaxLengthViolation,
	isWithinFieldMaxLength,
	resolveFieldMaxLength
} from './payloadMaxLength.js'

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

describe('isWithinFieldMaxLength', () => {
	it('allows any value when no limit is set', () => {
		assert.equal(
			isWithinFieldMaxLength({ id: 'h', label: 'H', type: 'string' as never }, 'anything long'),
			true
		)
	})

	it('rejects values longer than maxLength', () => {
		const field = { id: 'h', label: 'H', type: 'string' as never, maxLength: 5 }
		assert.equal(isWithinFieldMaxLength(field, 'abcde'), true)
		assert.equal(isWithinFieldMaxLength(field, 'abcdef'), false)
	})
})

describe('findPayloadMaxLengthViolation', () => {
	it('returns undefined when payload is within limits', () => {
		assert.equal(
			findPayloadMaxLengthViolation(
				[{ id: 'headline', label: 'Headline', type: 'string' as never, maxLength: 5 }],
				{ headline: 'abcde' }
			),
			undefined
		)
	})

	it('rejects option values that exceed maxLength', () => {
		const msg = findPayloadMaxLengthViolation(
			[
				{
					id: 'style',
					label: 'Style',
					type: 'string' as never,
					maxLength: 4,
					options: ['short', 'toolong']
				}
			],
			{ style: 'toolong' }
		)
		assert.equal(msg, 'Style exceeds max length (4)')
	})
})
