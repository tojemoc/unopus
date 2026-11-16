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
	it('does not inherit part duration onto empty L3D pieces (hold until Take)', () => {
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'l3d-mod', duration: undefined }, 6),
			undefined
		)
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'l3d-syn', duration: undefined }, 6),
			undefined
		)
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'l3d-odporucanie', duration: undefined }, 6),
			undefined
		)
		assert.equal(
			resolvePieceOnAirDuration({ pieceType: 'l3d-mod', duration: 4 }, 6),
			4
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

	it('does not plan part → L3D fills when piece On air is empty', () => {
		const plan = planStoryDurationSync(
			{ duration: 6 },
			[
				{ id: 'mod', pieceType: 'l3d-mod' },
				{ id: 'bug', pieceType: 'logo-bug' }
			]
		)

		assert.equal(plan.partDuration, undefined)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('does not plan part → syn / odporucanie fills when unset', () => {
		const plan = planStoryDurationSync(
			{ duration: 6 },
			[
				{ id: 'syn', pieceType: 'l3d-syn' },
				{ id: 'odp', pieceType: 'l3d-odporucanie' },
				{ id: 'bug', pieceType: 'logo-bug' }
			]
		)

		assert.equal(plan.partDuration, undefined)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('plans part duration from longest child when part unset, without filling siblings', () => {
		const plan = planStoryDurationSync(
			{ duration: 0 },
			[
				{ id: 'mod', pieceType: 'l3d-mod', duration: 8 },
				{ id: 'tema', pieceType: 'l3d-tema' },
				{ id: 'bug', pieceType: 'logo-bug' }
			]
		)

		assert.equal(plan.partDuration, 8)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('derives ILU and DoubleBox part duration from script reading time', () => {
		const script = 'a'.repeat(30) // 30 chars @ 15 CPS = 2s
		for (const partType of ['ilu', 'doublebox']) {
			assert.equal(
				resolvePartOnAirDuration(
					{ partType, script, duration: undefined },
					[{ pieceType: 'headline', duration: undefined }],
					{ scriptCps: 15 }
				),
				2
			)
		}
	})

	it('plans ILU script sync onto headline only (not L3D inherit fill)', () => {
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
		assert.deepEqual(plan.pieceUpdates, [{ id: 'il', duration: 2, force: true }])
	})

	it('ILU stays manual but script still drives On air', () => {
		const script = 'a'.repeat(30) // 2s @ 15 CPS
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'ilu', script, duration: 99, durationMode: 'manual' },
				[{ pieceType: 'headline', duration: 99 }],
				{ scriptCps: 15 }
			),
			2
		)

		const plan = planStoryDurationSync(
			{ partType: 'ilu', script, duration: 99, durationMode: 'manual' },
			[
				{ id: 'il', pieceType: 'headline', duration: 2 },
				{ id: 'l3d', pieceType: 'l3d-headline' }
			],
			{ scriptCps: 15 }
		)

		assert.equal(plan.partDuration, 2)
		assert.equal(plan.forcePartDuration, true)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('script duration fills an unset ILU On air and headline', () => {
		const script = 'a'.repeat(30)
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'ilu', script, duration: undefined, durationMode: 'manual' },
				[{ pieceType: 'headline', duration: undefined }],
				{ scriptCps: 15 }
			),
			2
		)

		const plan = planStoryDurationSync(
			{ partType: 'ilu', script, duration: undefined, durationMode: 'manual' },
			[{ id: 'il', pieceType: 'headline', duration: undefined }],
			{ scriptCps: 15 }
		)
		assert.equal(plan.partDuration, 2)
		assert.equal(plan.forcePartDuration, true)
		assert.deepEqual(plan.pieceUpdates, [{ id: 'il', duration: 2, force: true }])
	})

	it('site defaultDurationMode manual does not change script timing', () => {
		const script = 'a'.repeat(30)
		const plan = planStoryDurationSync(
			{ partType: 'ilu', script, duration: 45 },
			[{ id: 'il', pieceType: 'headline', duration: 2 }],
			{ scriptCps: 15, defaultDurationMode: 'manual' }
		)
		assert.equal(plan.partDuration, 2)
		assert.equal(plan.forcePartDuration, true)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('plain SYN AUTO uses clip duration instead of script or stale On air', () => {
		const script = 'a'.repeat(30) // 2s @ 15 CPS — must not be used
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'syn', script, duration: 99, durationMode: 'auto' },
				[{ pieceType: 'video', duration: 40 }],
				{ scriptCps: 15 }
			),
			40
		)
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'syn', script, duration: 99, durationMode: 'manual' },
				[{ pieceType: 'video', duration: 40 }],
				{ scriptCps: 15 }
			),
			99
		)
	})

	it('plain SYN AUTO prefers trimmed sourceDuration over stale durations', () => {
		const pieces = [
			{
				pieceType: 'video',
				duration: 40,
				payload: { sourceDuration: 20_000, trimIn: 2, trimOut: 1 }
			}
		]
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'syn', duration: 99, durationMode: 'auto' },
				pieces,
				{ scriptCps: 15 }
			),
			17
		)

		const plan = planStoryDurationSync(
			{ partType: 'syn', duration: 99, durationMode: 'auto' },
			[{ id: 'syn', ...pieces[0] }],
			{ scriptCps: 15 }
		)
		assert.equal(plan.partDuration, 17)
		assert.equal(plan.forcePartDuration, true)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('trims the piece-duration fallback when sourceDuration is missing', () => {
		const pieces = [
			{
				pieceType: 'video',
				duration: 40,
				payload: { trimIn: 2, trimOut: 1 }
			}
		]
		assert.equal(
			resolvePartOnAirDuration({ partType: 'syn', duration: 99, durationMode: 'auto' }, pieces),
			37
		)
		assert.equal(
			resolvePartOnAirDuration({ partType: 'vt', duration: undefined, durationMode: 'manual' }, pieces),
			37
		)
	})

	it('marker-qualified SYN and SJV/ŠPORT keep script timing', () => {
		const script = 'a'.repeat(30)
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'syn', script, duration: 99, durationMode: 'auto' },
				[
					{ pieceType: 'video', duration: 40 },
					{ pieceType: 'l3d-sjv', duration: undefined }
				],
				{ scriptCps: 15 }
			),
			2
		)
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'sport', script, duration: 99, durationMode: 'auto' },
				[{ pieceType: 'l3d-sport', duration: undefined }],
				{ scriptCps: 15 }
			),
			2
		)
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
		assert.deepEqual(plan.pieceUpdates, [])
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

	it('AUTO SYN uses trimmed sourceDuration for part without changing piece On air', () => {
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
				duration: 18,
				payload: { sourceDuration: 12000, trimIn: 2, trimOut: 1 }
			}
		])
		assert.equal(plan.partDuration, 9)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('VO/VT fallback uses trimmed source, ignoring shorter editorial On air', () => {
		for (const editorial of [5, 18]) {
			const plan = planStoryDurationSync({ duration: 0, partType: 'vt' }, [
				{
					id: 'vt',
					pieceType: 'video',
					duration: editorial,
					payload: { sourceDuration: 12000, trimIn: 2, trimOut: 1 }
				}
			])
			assert.equal(plan.partDuration, 9)
			assert.deepEqual(plan.pieceUpdates, [])
		}
	})

	it('does not revive stale durations when source metadata is exhausted', () => {
		const pieces = [
			{
				pieceType: 'video',
				duration: 18,
				payload: { sourceDuration: 3000, trimIn: 2, trimOut: 1.5 }
			}
		]
		assert.equal(
			resolvePartOnAirDuration(
				{ partType: 'syn', duration: 99, durationMode: 'auto' },
				pieces
			),
			undefined
		)
		assert.equal(
			resolvePartOnAirDuration({ partType: 'vt', duration: undefined }, pieces),
			undefined
		)

		const plan = planStoryDurationSync(
			{ partType: 'syn', duration: 99, durationMode: 'auto' },
			[{ id: 'syn', ...pieces[0] }]
		)
		assert.equal(plan.partDuration, 0)
		assert.equal(plan.forcePartDuration, true)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('uses trimmed source for part duration when video On air is empty', () => {
		const plan = planStoryDurationSync({ duration: 0, partType: 'syn' }, [
			{
				id: 'syn',
				pieceType: 'video',
				payload: { sourceDuration: 12000, trimIn: 2, trimOut: 1 }
			}
		])
		assert.equal(plan.partDuration, 9)
		assert.deepEqual(plan.pieceUpdates, [])
	})

	it('rejects trimmed durations that round to zero', () => {
		assert.equal(
			resolveTrimmedSourceDurationSeconds({
				pieceType: 'video',
				payload: { sourceDuration: 40 }
			}),
			undefined
		)
	})
})
