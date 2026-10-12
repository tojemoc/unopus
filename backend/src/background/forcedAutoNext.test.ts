import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveForcedAutoNext } from './forcedAutoNext'
import { type TypeManifest, TypeManifestEntity } from './interfaces'

const m = (
	id: string,
	entityType: TypeManifestEntity,
	extra: Partial<TypeManifest>
): TypeManifest => ({
	id,
	entityType,
	name: id,
	shortName: id,
	colour: '#000',
	payload: [],
	...extra
})

const manifests = [
	m('intro', TypeManifestEntity.Part, { autoNext: true }),
	m('ilu', TypeManifestEntity.Part, {}),
	m('weather', TypeManifestEntity.Piece, { forcesAutoNext: true })
]

describe('resolveForcedAutoNext', () => {
	it('flags part types with autoNext', () => {
		assert.deepEqual(resolveForcedAutoNext(manifests, { partType: 'intro' }, [], 10), {
			forced: true,
			missingDuration: false
		})
	})
	it('flags forcing piece types, ignoring skipped ones', () => {
		assert.equal(
			resolveForcedAutoNext(manifests, { partType: 'ilu' }, [{ pieceType: 'weather' }], 5).forced,
			true
		)
		assert.equal(
			resolveForcedAutoNext(
				manifests,
				{ partType: 'ilu' },
				[{ pieceType: 'weather', skip: true }],
				5
			).forced,
			false
		)
	})
	it('warns on empty/0 duration', () => {
		assert.equal(
			resolveForcedAutoNext(manifests, { partType: 'intro' }, [], 0).missingDuration,
			true
		)
		assert.equal(
			resolveForcedAutoNext(manifests, { partType: 'intro' }, [], undefined).missingDuration,
			true
		)
	})
	it('does not force AUTO for skipped or floated parts', () => {
		for (const excluded of [{ skip: true }, { float: true }, { skip: true, float: true }]) {
			for (const partType of ['intro', 'ilu']) {
				assert.deepEqual(
					resolveForcedAutoNext(
						manifests,
						{ partType, ...excluded },
						[{ pieceType: 'weather' }],
						0
					),
					{ forced: false, missingDuration: false }
				)
			}
		}
	})
	it('does not flag other parts', () => {
		assert.deepEqual(resolveForcedAutoNext(manifests, { partType: 'ilu' }, [], 0), {
			forced: false,
			missingDuration: false
		})
	})
})
