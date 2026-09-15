import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toolbarGroupedManifests, toolbarManifests } from './typeManifest.js'

/** Minimal piece-shaped fixture — mirrors other frontend util tests (no backend enum import). */
type PieceFixture = {
	id: string
	entityType: 'piece'
	name: string
	shortName: string
	colour: string
	payload: []
	techOnly?: boolean
	showInToolbar?: boolean
	toolbarGroup?: string
}

const piece = (partial: Partial<PieceFixture> & Pick<PieceFixture, 'id'>): PieceFixture => ({
	entityType: 'piece',
	name: partial.id,
	shortName: partial.id,
	colour: '#000',
	payload: [],
	...partial
})

describe('toolbarManifests', () => {
	const manifests = [
		piece({ id: 'video', shortName: 'SYN' }),
		piece({ id: 'camera', shortName: 'Cam', techOnly: true, showInToolbar: false }),
		piece({ id: 'wipe', shortName: 'WIPE', techOnly: true }),
		piece({ id: 'vo', shortName: 'VO', showInToolbar: false }),
		piece({ id: 'l3d-tema', shortName: 'L3DT', toolbarGroup: 'l3d', showInToolbar: false })
	]

	it('hides techOnly and showInToolbar:false for editors', () => {
		const ids = toolbarManifests(manifests as never, 'piece' as never).map((m) => m.id)
		assert.deepEqual(ids, ['video'])
	})

	it('shows techOnly for tech admins even when showInToolbar is false', () => {
		const ids = toolbarManifests(manifests as never, 'piece' as never, {
			includeTechOnly: true
		}).map((m) => m.id)
		assert.deepEqual(ids.sort(), ['camera', 'video', 'wipe'])
	})

	it('keeps non-tech showInToolbar:false hidden for tech admins', () => {
		const ids = toolbarManifests(manifests as never, 'piece' as never, {
			includeTechOnly: true
		}).map((m) => m.id)
		assert.ok(!ids.includes('vo'))
	})
})

describe('toolbarGroupedManifests', () => {
	it('returns L3D variants for the group', () => {
		const manifests = [
			piece({ id: 'l3d-tema', toolbarGroup: 'l3d', showInToolbar: false }),
			piece({ id: 'l3d-mod', toolbarGroup: 'l3d', showInToolbar: false }),
			piece({ id: 'video' })
		]
		const ids = toolbarGroupedManifests(manifests as never, 'piece' as never, 'l3d').map(
			(m) => m.id
		)
		assert.deepEqual(ids, ['l3d-tema', 'l3d-mod'])
	})
})
