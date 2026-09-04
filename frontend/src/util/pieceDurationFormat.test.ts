import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	WIPE_CUT_POINT_SECONDS,
	findNearDuplicateMediaNames,
	formatSecondsClock,
	formatSecondsPrecise,
	parseDurationClockInput
} from './pieceDurationFormat.js'

describe('formatSecondsPrecise', () => {
	it('preserves wipe cut point hundredths (760ms → 0.76s, not 0.8s)', () => {
		assert.equal(formatSecondsPrecise(WIPE_CUT_POINT_SECONDS), '0.76s')
		assert.equal(formatSecondsPrecise(760 / 1000), '0.76s')
	})

	it('trims trailing zeros for whole or single-decimal values', () => {
		assert.equal(formatSecondsPrecise(2.5), '2.5s')
		assert.equal(formatSecondsPrecise(3), '3s')
	})
})

describe('parseDurationClockInput', () => {
	it('parses mm:ss and plain seconds', () => {
		assert.equal(parseDurationClockInput('01:20'), 80)
		assert.equal(parseDurationClockInput('1:20'), 80)
		assert.equal(parseDurationClockInput('80'), 80)
		assert.equal(parseDurationClockInput('12.5s'), 12.5)
		assert.equal(parseDurationClockInput(''), undefined)
		assert.equal(parseDurationClockInput('  '), undefined)
	})

	it('rejects invalid clocks', () => {
		assert.equal(parseDurationClockInput('1:99'), undefined)
		assert.equal(parseDurationClockInput('abc'), undefined)
	})
})

describe('formatSecondsClock', () => {
	it('formats whole seconds as mm:ss', () => {
		assert.equal(formatSecondsClock(80), '01:20')
		assert.equal(formatSecondsClock(5), '00:05')
	})
})

describe('findNearDuplicateMediaNames', () => {
	it('flags stems that differ by one character or a trailing digit', () => {
		const paths = [
			'clips/SYN SUSKO.mp4',
			'clips/SYN SUSKO2.mp4',
			'clips/SYN FEDOROV.mp4',
			'clips/OTHER.mp4'
		]
		assert.deepEqual(findNearDuplicateMediaNames('clips/SYN SUSKO.mp4', paths), [
			'clips/SYN SUSKO2.mp4'
		])
	})

	it('flags same base word with v2 / final / parenthetical suffixes', () => {
		const paths = [
			'clips/ILU REGISTER.mp4',
			'clips/ILU REGISTER v2.mp4',
			'clips/ILU REGISTER_final.mp4',
			'clips/ILU REGISTER (2).mp4',
			'clips/ILU OTHER.mp4'
		]
		assert.deepEqual(findNearDuplicateMediaNames('clips/ILU REGISTER.mp4', paths), [
			'clips/ILU REGISTER v2.mp4',
			'clips/ILU REGISTER_final.mp4',
			'clips/ILU REGISTER (2).mp4'
		])
	})
})
