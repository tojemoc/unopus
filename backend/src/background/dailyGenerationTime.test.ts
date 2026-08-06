import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	getDailyGeneratedDate,
	hasDailyCloneTimePassed,
	isValidDailyCloneTime,
	isValidIanaTimeZone
} from './dailyGenerationTime.js'

describe('getDailyGeneratedDate', () => {
	it('returns YYYY-MM-DD in Europe/Bratislava for a fixed instant', () => {
		// 2024-06-15 12:00 UTC → Bratislava CEST (UTC+2) = 2024-06-15
		const now = new Date('2024-06-15T12:00:00.000Z')
		assert.equal(getDailyGeneratedDate(now, 'Europe/Bratislava'), '2024-06-15')
	})

	it('uses Bratislava calendar date near UTC midnight (zone ahead of UTC)', () => {
		// 23:30 UTC on day D → Bratislava is already next calendar day in winter? 
		// Winter CET = UTC+1 → 2024-01-15 23:30 UTC = 2024-01-16 00:30 in Bratislava
		const now = new Date('2024-01-15T23:30:00.000Z')
		assert.equal(getDailyGeneratedDate(now, 'Europe/Bratislava'), '2024-01-16')
		assert.notEqual(now.toISOString().slice(0, 10), '2024-01-16')
	})

	it('does not use process-local getFullYear/getMonth/getDate', () => {
		const now = new Date('2024-01-15T23:30:00.000Z')
		const viaHelper = getDailyGeneratedDate(now, 'UTC')
		assert.equal(viaHelper, '2024-01-15')
	})
})

describe('hasDailyCloneTimePassed', () => {
	it('is false before the configured wall-clock time', () => {
		// Bratislava CEST UTC+2: 2024-06-15 07:00 local = 05:00 UTC
		const now = new Date('2024-06-15T05:00:00.000Z')
		assert.equal(hasDailyCloneTimePassed(now, '08:00', 'Europe/Bratislava'), false)
	})

	it('is true after the configured wall-clock time (delayed tick)', () => {
		const now = new Date('2024-06-15T07:00:00.000Z') // 09:00 Bratislava
		assert.equal(hasDailyCloneTimePassed(now, '08:00', 'Europe/Bratislava'), true)
	})

	it('is true at exact HH:mm', () => {
		const now = new Date('2024-06-15T06:00:00.000Z') // 08:00 Bratislava
		assert.equal(hasDailyCloneTimePassed(now, '08:00', 'Europe/Bratislava'), true)
	})

	it('spring-forward gap: 02:30 treated as passed once local time is after the gap', () => {
		// EU DST 2024: Europe/Bratislava springs forward 2024-03-31 02:00 → 03:00
		// 02:30 does not exist; at 03:00 local (01:00 UTC) wall clock >= 02:30
		const afterGap = new Date('2024-03-31T01:00:00.000Z') // 03:00 CEST
		assert.equal(hasDailyCloneTimePassed(afterGap, '02:30', 'Europe/Bratislava'), true)
		const beforeGap = new Date('2024-03-31T00:30:00.000Z') // 01:30 CET
		assert.equal(hasDailyCloneTimePassed(beforeGap, '02:30', 'Europe/Bratislava'), false)
	})

	it('fall-back fold: first wall-clock 02:30 occurrence satisfies time-passed', () => {
		// EU DST 2024: Europe/Bratislava falls back 2024-10-27 03:00 → 02:00
		// First 02:30 CEST ≈ 00:30 UTC; second 02:30 CET ≈ 01:30 UTC
		const firstOccurrence = new Date('2024-10-27T00:30:00.000Z')
		assert.equal(
			hasDailyCloneTimePassed(firstOccurrence, '02:30', 'Europe/Bratislava'),
			true
		)
	})
})

describe('settings field validators', () => {
	it('accepts valid HH:mm and rejects invalid dailyCloneTime', () => {
		assert.equal(isValidDailyCloneTime('00:00'), true)
		assert.equal(isValidDailyCloneTime('23:59'), true)
		assert.equal(isValidDailyCloneTime('08:30'), true)
		assert.equal(isValidDailyCloneTime(undefined), true)
		assert.equal(isValidDailyCloneTime(''), true)
		assert.equal(isValidDailyCloneTime('24:00'), false)
		assert.equal(isValidDailyCloneTime('8:30'), false)
		assert.equal(isValidDailyCloneTime('25:00'), false)
		assert.equal(isValidDailyCloneTime('ab:cd'), false)
	})

	it('accepts Europe/Bratislava and rejects bogus timezones', () => {
		assert.equal(isValidIanaTimeZone('Europe/Bratislava'), true)
		assert.equal(isValidIanaTimeZone('UTC'), true)
		assert.equal(isValidIanaTimeZone('Not/AZone'), false)
	})
})
