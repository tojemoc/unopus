import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	planStoryDurationSync,
	resolvePartOnAirDuration,
	resolvePieceOnAirDuration,
	resolveTrimmedSourceDurationSeconds,
	sumPartsOnAirDuration
} from './storyDuration.js'

describe('storyDuration', () => {
	it('resolves piece duration from part when inheriting type has none', () => {
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'l3d-mod', duration: undefined }, 6),
			6
		)
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'l3d-predstavovak', duration: undefined }, 6),
			6
		)
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'l3d-odporucanie', duration: undefined }, 6),
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

	it('plans story sync: part → l3d-predstavovak and l3d-odporucanie when unset', () => {
		const plan = planStoryDurationSync(
			{ duration: 6 },
			[
				{ id: 'pred', pieceType: 'l3d-predstavovak' },
				{ id: 'odp', pieceType: 'l3d-odporucanie' },
				{ id: 'bug', pieceType: 'logo-bug' }
			]
		)

		assert.equal(plan.partDuration, undefined)
		assert.deepEqual(plan.pieceUpdates, [
			{ id: 'pred', duration: 6 },
			{ id: 'odp', duration: 6 }
		])
	})

	it('plans Mod story sync: child → part when part unset', () => {
		const plan = planStoryDurationSync(
			{ duration: 0 },
			[
				{ id: 'mod', pieceType: 'l3d-mod', duration: 8 },
				{ id: 'tema', pieceType: 'l3d-tema' },
				{ id: 'bug', pieceType: 'logo-bug' }
			]
		)

		assert.equal(plan.partDuration, 8)
		assert.deepEqual(plan.pieceUpdates, [{ id: 'tema', duration: 8 }])
	})

	it('derives ILU part duration from script reading time', () => {
		const script = 'a'.repeat(30) // 30 chars @ 15 CPS = 2s
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'ilu', script, duration: undefined },
				[{ pieceType: 'headline', duration: undefined }],
				{ scriptCps: 15 }
			),
			2
		)
	})

	it('plans ILU script sync onto headline and part', () => {
		const script = 'a'.repeat(30)
		const plan = planStoryDurationSync(
			{ partType: 'ilu', script, duration: 99 },
			[
				{ id: 'il', pieceType: 'headline', duration: 99 },
				{ id: 'l3d', pieceType: 'l3d-headline' },
				{ id: 'cam', pieceType: 'camera' }
			],
			{ scriptCps: 15 }
		)

		assert.equal(plan.partDuration, 2)
		assert.equal(plan.forcePartDuration, true)
		assert.deepEqual(plan.pieceUpdates, [
			{ id: 'il', duration: 2, force: true },
			{ id: 'l3d', duration: 2 }
		])
	})

	it('excludes skipped pieces from duration and sync', () => {
		assert.equal(
			resolvePartOnAirDuration(
				{ duration: undefined },
				[
					{ pieceType: 'video', duration: 12, skip: true },
					{ pieceType: 'video', duration: 5 }
				]
			),
			5
		)

		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'headline', duration: 10, skip: true }, 10),
			undefined
		)

		const plan = planStoryDurationSync({ duration: 6 }, [
			{ id: 'il', pieceType: 'headline', skip: true },
			{ id: 'l3d', pieceType: 'l3d-headline' }
		])
		assert.deepEqual(plan.pieceUpdates, [{ id: 'l3d', duration: 6 }])
	})

	it('skipped parts contribute nothing to rundown sum', () => {
		const total = sumPartsOnAirDuration(
			[
				{
					part: { partType: 'ilu', script: 'a'.repeat(30), skip: true },
					pieces: []
				},
				{
					part: { partType: 'syn', duration: 10 },
					pieces: [{ pieceType: 'video', duration: 10 }]
				}
			],
			{ scriptCps: 15 }
		)
		assert.equal(total, 10)
	})

	it('trims SYN sourceDuration by trimIn/trimOut and writes piece duration', () => {
		assert.equal(
			resolveTrimmedSourceDurationSeconds({
				pieceType: 'video',
				payload: { sourceDuration: 12000, trimIn: 2, trimOut: 1 }
			}),
			9
		)

		const plan = planStoryDurationSync({ duration: 0, partType: 'syn' }, [
			{
				id: 'syn',
				pieceType: 'video',
				payload: { sourceDuration: 12000, trimIn: 2, trimOut: 1 }
			}
		])
		assert.equal(plan.partDuration, 9)
		assert.deepEqual(plan.pieceUpdates, [{ id: 'syn', duration: 9, force: true }])
	})
})
