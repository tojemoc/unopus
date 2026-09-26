import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mutatePieceForExport } from './pieces.js'
import type { Piece } from '../interfaces.js'

function makePiece(overrides: Partial<Piece> = {}): Piece {
	return {
		id: 'piece-1',
		playlistId: null,
		rundownId: 'rundown-1',
		segmentId: 'segment-1',
		partId: 'part-1',
		name: 'Test piece',
		pieceType: 'headline',
		payload: { text: 'Hello' },
		...overrides
	}
}

describe('mutatePieceForExport', () => {
	it('exports ILU headline pieces on the timeline at 0, not as adlib', () => {
		const exported = mutatePieceForExport(
			makePiece({
				pieceType: 'headline',
				payload: { text: 'Headline one', source: 'TASR' }
			})
		)

		assert.equal(exported.objectTime, 0)
		assert.equal(exported.attributes.adlib, false)
		assert.equal(exported.objectType, 'headline')
	})

	it('exports GFX pieces on the timeline at 0 when start is omitted', () => {
		const exported = mutatePieceForExport(
			makePiece({
				pieceType: 'l3d-tema',
				payload: { headline: 'Správy', subline: 'Téma' }
			})
		)

		assert.equal(exported.objectTime, 0)
		assert.equal(exported.attributes.adlib, false)
		assert.equal(exported.objectType, 'l3d-tema')
	})

	it('preserves an explicit non-zero start offset', () => {
		const exported = mutatePieceForExport(
			makePiece({
				pieceType: 'video',
				start: 12,
				payload: { fileName: 'clips/vo.mp4' }
			})
		)

		assert.equal(exported.objectTime, 12)
		assert.equal(exported.attributes.adlib, false)
	})

	it('exposes top-level skip for duration math while keeping attributes.skip', () => {
		const exported = mutatePieceForExport(
			makePiece({
				pieceType: 'l3d-sjv',
				skip: true,
				payload: { headline: 'SJV' }
			})
		)

		assert.equal(exported.skip, true)
		assert.equal(exported.attributes.skip, true)
	})

	it('always exports wipe cutPoint ms for blueprints (default 380 when unset)', () => {
		const without = mutatePieceForExport(
			makePiece({
				pieceType: 'wipe',
				duration: 2.5,
				payload: { fileName: 'wipes/wipe.mov', transition: 'Double Box' }
			})
		)
		assert.equal(without.attributes.cutPoint, 380)

		const editorial = mutatePieceForExport(
			makePiece({
				pieceType: 'wipe',
				duration: 2.5,
				payload: { fileName: 'wipes/wipe.mov', cutPoint: 500 }
			})
		)
		assert.equal(editorial.attributes.cutPoint, 500)

		const asString = mutatePieceForExport(
			makePiece({
				pieceType: 'wipe',
				payload: { fileName: 'wipes/wipe.mov', cutPoint: '900' }
			})
		)
		assert.equal(asString.attributes.cutPoint, 900)
	})
})
