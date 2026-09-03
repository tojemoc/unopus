import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encodeJsonMergePatchClears } from './jsonMergePatch.js'

describe('encodeJsonMergePatchClears', () => {
	it('turns undefined / empty clears into JSON null for json_patch deletion', () => {
		assert.deepEqual(
			encodeJsonMergePatchClears({ duration: undefined, start: '', name: 'x' }, [
				'duration',
				'start'
			]),
			{ duration: null, start: null, name: 'x' }
		)
	})

	it('leaves positive durations untouched', () => {
		assert.deepEqual(encodeJsonMergePatchClears({ duration: 18 }, ['duration']), {
			duration: 18
		})
	})
})
