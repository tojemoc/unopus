import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { convertOldPartToNew } from './convertOldPart.js'

describe('convertOldPartToNew', () => {
	it('keeps top-level script when partType is already set (smoke / modern export)', () => {
		const script =
			'Zajtra sa oteplí a bude až do 34 stupňov. Na väčšine územia bude oblačno, na východe jasno. Večer sa začnú od juhozápadu intenzívne búrky.'
		const part = {
			id: 'part-weather',
			playlistId: null,
			rundownId: 'spravy-v3-smoke',
			segmentId: 'seg-weather',
			name: 'Počasie',
			rank: 0,
			float: false,
			partType: 'gfx',
			duration: 2.5,
			script,
			payload: {
				name: 'Počasie',
				type: 'GFX'
			}
		}

		const converted = convertOldPartToNew(part)
		assert.equal(converted.script, script)
		assert.equal(converted.duration, 2.5)
		assert.equal(converted.partType, 'gfx')
		assert.equal(converted.payload?.type, 'GFX')
	})

	it('lifts script/duration/type from payload for true legacy parts', () => {
		const part = {
			id: 'legacy-1',
			playlistId: null,
			rundownId: 'rd',
			segmentId: 'seg',
			name: 'Old',
			rank: 0,
			float: false,
			payload: {
				type: 'cam',
				script: 'Legacy prompter text',
				duration: 12,
				name: 'Old'
			}
		}

		const converted = convertOldPartToNew(part)
		assert.equal(converted.partType, 'cam')
		assert.equal(converted.script, 'Legacy prompter text')
		assert.equal(converted.duration, 12)
		assert.equal(converted.payload?.name, 'Old')
		assert.equal(converted.payload?.type, undefined)
		assert.equal(converted.payload?.script, undefined)
	})

	it('prefers top-level script over payload.script when migrating', () => {
		const part = {
			id: 'mixed',
			playlistId: null,
			rundownId: 'rd',
			segmentId: 'seg',
			name: 'Mixed',
			rank: 0,
			float: false,
			script: 'Top-level wins',
			payload: {
				type: 'gfx',
				script: 'Payload loses'
			}
		}

		const converted = convertOldPartToNew(part)
		assert.equal(converted.script, 'Top-level wins')
		assert.equal(converted.partType, 'gfx')
	})
})
