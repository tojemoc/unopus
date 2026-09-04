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

	it('does not match identical basenames in different folders', () => {
		const paths = ['clips/CLIP1.mp4', 'other/CLIP2.mp4', 'other/CLIP1.mp4']
		assert.deepEqual(findNearDuplicateMediaNames('other/CLIP1.mp4', paths), ['other/CLIP2.mp4'])
		assert.deepEqual(findNearDuplicateMediaNames('clips/CLIP1.mp4', paths), [])
	})

	it('flags a one-character insertion or deletion in the middle of the stem', () => {
		const paths = ['clips/SYN SUSKO.mp4', 'clips/SYN SSKO.mp4', 'clips/SYN FEDOROV.mp4']
		assert.deepEqual(findNearDuplicateMediaNames('clips/SYN SUSKO.mp4', paths), [
			'clips/SYN SSKO.mp4'
		])
	})
})
