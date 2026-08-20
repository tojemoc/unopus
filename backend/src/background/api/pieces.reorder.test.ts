import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveReorderTargetIndex } from '../util.js'

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
