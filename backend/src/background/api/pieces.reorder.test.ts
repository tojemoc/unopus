import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveReorderTargetIndex } from '../util.js'
import { mutations } from './pieces.js'

describe('resolveReorderTargetIndex', () => {
	it('applies the client relative delta to the server source index', () => {
		// Client saw source at 2 and moved up to 1; server currently has it at 3.
		assert.equal(resolveReorderTargetIndex(3, 2, 1, 5), 2)
	})

	it('clamps relative moves to the list bounds', () => {
		assert.equal(resolveReorderTargetIndex(0, 1, 0, 4), 0)
		assert.equal(resolveReorderTargetIndex(3, 2, 3, 4), 3)
	})
})

describe('mutations.reorder payload validation', () => {
	it('rejects missing element ids before reading pieces', async () => {
		const { error } = await mutations.reorder({
			element: { id: '', partId: 'part-1' } as never,
			sourceIndex: 0,
			targetIndex: 1
		})
		assert.ok(error)
		assert.match(error.message, /Invalid piece reorder payload/)
	})

	it('rejects non-integer indices before reading pieces', async () => {
		const { error } = await mutations.reorder({
			element: { id: 'piece-1', partId: 'part-1' } as never,
			sourceIndex: 0.5,
			targetIndex: 1
		})
		assert.ok(error)
		assert.match(error.message, /Invalid piece reorder payload/)
	})
})
