import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	ManifestFieldType,
	type Piece,
	type TypeManifest,
	TypeManifestEntity
} from './interfaces.js'
import { evaluatePieceReadiness } from './mediaReadiness.js'
import type { CorePieceContentStatus } from './coreContentStatus.js'

const VIDEO_MANIFEST: TypeManifest = {
	id: 'video',
	entityType: TypeManifestEntity.Piece,
	name: 'Video',
	shortName: 'VID',
	colour: '#000',
	payload: [
		{
			id: 'fileName',
			label: 'File',
			type: ManifestFieldType.MediaPick
		}
	]
}

const PIECE_WITH_MEDIA: Piece = {
	id: 'piece-1',
	playlistId: null,
	rundownId: 'rundown-1',
	segmentId: 'seg-1',
	partId: 'part-1',
	name: 'Clip',
	pieceType: 'video',
	payload: {
		fileName: 'clips/foo.mp4'
	}
}

describe('evaluatePieceReadiness hybrid Core status', () => {
	it('uses Core ready status for media paths without touching the filesystem', async () => {
		const coreStatus: CorePieceContentStatus = {
			pieceExternalId: 'piece-1',
			statusCode: 0,
			ready: true
		}

		const result = await evaluatePieceReadiness(
			PIECE_WITH_MEDIA,
			[VIDEO_MANIFEST],
			{
				checkFile: async () => {
					throw new Error('filesystem should not be consulted when Core status is available')
				}
			},
			coreStatus
		)

		assert.equal(result.ready, true)
		assert.equal(result.requirements.length, 1)
		assert.equal(result.requirements[0]?.ready, true)
	})

	it('uses Core not-ready reason when Package Manager reports missing media', async () => {
		const coreStatus: CorePieceContentStatus = {
			pieceExternalId: 'piece-1',
			statusCode: 30,
			ready: false,
			reason: "VT can't be found on the playout system"
		}

		const result = await evaluatePieceReadiness(
			PIECE_WITH_MEDIA,
			[VIDEO_MANIFEST],
			{
				checkFile: async () => true
			},
			coreStatus
		)

		assert.equal(result.ready, false)
		assert.match(result.requirements[0]?.reason ?? '', /playout system/)
	})

	it('falls back to filesystem when Core status is absent', async () => {
		let fsChecked = false

		const result = await evaluatePieceReadiness(
			PIECE_WITH_MEDIA,
			[VIDEO_MANIFEST],
			{
				checkFile: async () => {
					fsChecked = true
					return true
				}
			}
		)

		assert.equal(fsChecked, true)
		assert.equal(result.ready, true)
	})
})
