import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
	clearPresenceFocus,
	listPresenceFocuses,
	resetPresenceForTests,
	setPresenceFocus,
	trySetPresenceFocus
} from './presence.js'

describe('presence', () => {
	beforeEach(() => {
		resetPresenceForTests()
	})

	it('tracks one focus per socket and replaces on re-focus', () => {
		setPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-1'
		})
		setPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'piece',
			entityId: 'x1',
			rundownId: 'r1',
			leaseId: 'lease-2'
		})

		assert.deepEqual(listPresenceFocuses('r1'), [
			{
				socketId: 's1',
				userId: 'u1',
				displayName: 'Kubo',
				entityType: 'piece',
				entityId: 'x1',
				rundownId: 'r1',
				leaseId: 'lease-2'
			}
		])
	})

	it('filters by rundown and clears on blur', () => {
		setPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-1'
		})
		setPresenceFocus({
			socketId: 's2',
			userId: 'u2',
			displayName: 'Ondro',
			entityType: 'part',
			entityId: 'p2',
			rundownId: 'r2',
			leaseId: 'lease-2'
		})

		assert.equal(listPresenceFocuses('r1').length, 1)
		clearPresenceFocus('s1')
		assert.equal(listPresenceFocuses('r1').length, 0)
		assert.equal(listPresenceFocuses('r2').length, 1)
	})

	it('blocks a second user from focusing the same story without force', () => {
		const first = trySetPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-1'
		})
		assert.equal(first.ok, true)

		const blocked = trySetPresenceFocus({
			socketId: 's2',
			userId: 'u2',
			displayName: 'Ondro',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-2'
		})
		assert.equal(blocked.ok, false)
		if (!blocked.ok) {
			assert.equal(blocked.holder.displayName, 'Kubo')
		}
		assert.equal(listPresenceFocuses('r1').length, 1)
		assert.equal(listPresenceFocuses('r1')[0]?.socketId, 's1')
	})

	it('force-acquires and returns the evicted holder', () => {
		trySetPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-1'
		})

		const takeover = trySetPresenceFocus(
			{
				socketId: 's2',
				userId: 'u2',
				displayName: 'Ondro',
				entityType: 'part',
				entityId: 'p1',
				rundownId: 'r1',
				leaseId: 'lease-2'
			},
			{ force: true }
		)

		assert.equal(takeover.ok, true)
		if (takeover.ok) {
			assert.equal(takeover.evicted.length, 1)
			assert.equal(takeover.evicted[0]?.socketId, 's1')
			assert.equal(takeover.leaseId, 'lease-2')
		}
		assert.deepEqual(listPresenceFocuses('r1').map((f) => f.socketId), ['s2'])
	})

	it('auto-evicts the same user on another socket without force', () => {
		trySetPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-1'
		})

		const secondTab = trySetPresenceFocus({
			socketId: 's2',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-2'
		})

		assert.equal(secondTab.ok, true)
		if (secondTab.ok) {
			assert.equal(secondTab.evicted[0]?.socketId, 's1')
		}
		assert.equal(listPresenceFocuses('r1')[0]?.socketId, 's2')
	})

	it('lease-scoped blur leaves a newer acquisition intact', () => {
		trySetPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-old'
		})
		trySetPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'part',
			entityId: 'p1',
			rundownId: 'r1',
			leaseId: 'lease-new'
		})

		clearPresenceFocus('s1', 'lease-old')
		assert.equal(listPresenceFocuses('r1')[0]?.leaseId, 'lease-new')

		clearPresenceFocus('s1', 'lease-new')
		assert.equal(listPresenceFocuses('r1').length, 0)
	})
})
