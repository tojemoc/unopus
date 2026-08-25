import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
	clearPresenceFocus,
	listPresenceFocuses,
	resetPresenceForTests,
	setPresenceFocus
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
			rundownId: 'r1'
		})
		setPresenceFocus({
			socketId: 's1',
			userId: 'u1',
			displayName: 'Kubo',
			entityType: 'piece',
			entityId: 'x1',
			rundownId: 'r1'
		})

		assert.deepEqual(listPresenceFocuses('r1'), [
			{
				socketId: 's1',
				userId: 'u1',
				displayName: 'Kubo',
				entityType: 'piece',
				entityId: 'x1',
				rundownId: 'r1'
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
			rundownId: 'r1'
		})
		setPresenceFocus({
			socketId: 's2',
			userId: 'u2',
			displayName: 'Ondro',
			entityType: 'part',
			entityId: 'p2',
			rundownId: 'r2'
		})

		assert.equal(listPresenceFocuses('r1').length, 1)
		clearPresenceFocus('s1')
		assert.equal(listPresenceFocuses('r1').length, 0)
		assert.equal(listPresenceFocuses('r2').length, 1)
	})
})
