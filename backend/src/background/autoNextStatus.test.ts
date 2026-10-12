import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AUTO_NEXT_PENDING_GRACE_MS, getAutoNextStatus } from './autoNextStatus'

const enabledPart = { partExternalId: 'part-1', autoNext: true, expectedDuration: 8_000 }
const disabledPart = { partExternalId: 'part-1', autoNext: false, expectedDuration: 8_000 }

describe('getAutoNextStatus', () => {
	it('confirms matching Core AUTO state', () => {
		assert.equal(
			getAutoNextStatus({ source: 'core', intentOn: true, part: enabledPart }),
			'confirmed'
		)
		assert.equal(
			getAutoNextStatus({ source: 'core', intentOn: false, part: disabledPart }),
			'confirmed'
		)
	})

	it('reports a recent ingest mismatch as pending', () => {
		assert.equal(
			getAutoNextStatus({
				source: 'core',
				intentOn: true,
				part: disabledPart,
				lastIngestAt: 9_000,
				now: 9_000 + AUTO_NEXT_PENDING_GRACE_MS - 1
			}),
			'pending'
		)
	})

	it('reports a stale mismatch after the grace period', () => {
		assert.equal(
			getAutoNextStatus({
				source: 'core',
				intentOn: true,
				part: disabledPart,
				lastIngestAt: 1_000,
				now: 1_000 + AUTO_NEXT_PENDING_GRACE_MS
			}),
			'mismatch'
		)
	})

	it('explains AUTO on with no expected duration', () => {
		assert.equal(
			getAutoNextStatus({
				source: 'core',
				intentOn: true,
				part: { partExternalId: 'part-1', autoNext: false, expectedDuration: null }
			}),
			'no-duration'
		)
	})

	it('reports Core down, errors, and unsynced rundowns as unknown', () => {
		assert.equal(getAutoNextStatus({ source: 'core-disconnected', intentOn: false }), 'unknown')
		assert.equal(getAutoNextStatus({ source: 'core-error', intentOn: false }), 'unknown')
		assert.equal(getAutoNextStatus({ source: 'not-synced', intentOn: true }), 'unknown')
	})
})
