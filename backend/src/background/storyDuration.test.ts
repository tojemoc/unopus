import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	planStoryDurationSync,
	resolvePartOnAirDuration,
	resolvePieceOnAirDuration
} from './storyDuration.js'

describe('storyDuration', () => {
	it('resolves piece duration from part when inheriting type has none', () => {
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'l3d-mod', duration: undefined }, 6),
			6
		)
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'logo-bug', duration: undefined }, 6),
			undefined
		)
	})

	it('resolves part duration from longest child when part is empty', () => {
		assert.equal(
			resolvePartOnAirDuration(
				{ duration: 0 },
				[
					{ pieceType: 'l3d-mod', duration: 8 },
					{ pieceType: 'logo-bug', duration: undefined }
				]
			),
			8
		)
	})

	it('plans Mod story sync: part → l3d-mod when piece unset', () => {
		const plan = planStoryDurationSync(
			{ duration: 6 },
			[
				{ id: 'mod', pieceType: 'l3d-mod' },
				{ id: 'bug', pieceType: 'logo-bug' }
			]
		)

		assert.equal(plan.partDuration, undefined)
		assert.deepEqual(plan.pieceUpdates, [{ id: 'mod', duration: 6 }])
	})

	it('plans Mod story sync: child → part when part unset', () => {
		const plan = planStoryDurationSync(
			{ duration: 0 },
			[
				{ id: 'mod', pieceType: 'l3d-mod', duration: 8 },
				{ id: 'bug', pieceType: 'logo-bug' }
			]
		)

		assert.equal(plan.partDuration, 8)
		assert.deepEqual(plan.pieceUpdates, [])
	})
})
