import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { TypeManifest, TypeManifestEntity } from './interfaces'
import { findTypeManifest } from './manifestMaterialize'

function manifest(
	partial: Pick<TypeManifest, 'id' | 'entityType'> & Partial<TypeManifest>
): TypeManifest {
	return {
		name: partial.name ?? partial.id,
		shortName: partial.shortName ?? partial.id.slice(0, 3).toUpperCase(),
		colour: partial.colour ?? '#000000',
		payload: partial.payload ?? [],
		...partial
	}
}

describe('findTypeManifest entityType scoping', () => {
	const manifests: TypeManifest[] = [
		manifest({
			id: 'intro',
			entityType: TypeManifestEntity.Piece,
			name: 'Intro overlay',
			shortName: 'INTRO'
		}),
		manifest({
			id: 'intro',
			entityType: TypeManifestEntity.Part,
			name: 'Intro',
			shortName: 'Intro',
			ingestType: 'Intro'
		}),
		manifest({
			id: 'cam',
			entityType: TypeManifestEntity.Part,
			name: 'Cam',
			ingestType: 'Cam'
		}),
		manifest({
			id: 'camera',
			entityType: TypeManifestEntity.Piece,
			name: 'Camera',
			ingestType: 'Cam'
		})
	]

	it('selects the piece when scoped to Piece for an exact shared id', () => {
		const found = findTypeManifest(manifests, 'intro', TypeManifestEntity.Piece)
		assert.equal(found?.entityType, TypeManifestEntity.Piece)
		assert.equal(found?.name, 'Intro overlay')
	})

	it('selects the part when scoped to Part for an exact shared id', () => {
		const found = findTypeManifest(manifests, 'intro', TypeManifestEntity.Part)
		assert.equal(found?.entityType, TypeManifestEntity.Part)
		assert.equal(found?.name, 'Intro')
	})

	it('scopes case-insensitive id matches by entityType', () => {
		const piece = findTypeManifest(manifests, 'INTRO', TypeManifestEntity.Piece)
		const part = findTypeManifest(manifests, 'INTRO', TypeManifestEntity.Part)
		assert.equal(piece?.entityType, TypeManifestEntity.Piece)
		assert.equal(part?.entityType, TypeManifestEntity.Part)
	})

	it('scopes ingestType matches by entityType', () => {
		const part = findTypeManifest(manifests, 'Cam', TypeManifestEntity.Part)
		const piece = findTypeManifest(manifests, 'Cam', TypeManifestEntity.Piece)
		assert.equal(part?.id, 'cam')
		assert.equal(piece?.id, 'camera')
	})

	it('keeps unscoped compatibility by returning the first matching id', () => {
		const found = findTypeManifest(manifests, 'intro')
		assert.equal(found?.id, 'intro')
		assert.equal(found?.entityType, TypeManifestEntity.Piece)
	})
})
