import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	ManifestFieldType,
	type Piece,
	type TypeManifest,
	TypeManifestEntity
} from './interfaces.js'
import {
	countReadinessProvenance,
	evaluatePieceReadiness,
	evaluateRundownReadiness
} from './mediaReadiness.js'
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

const PIECE_TWO: Piece = {
	...PIECE_WITH_MEDIA,
	id: 'piece-2',
	name: 'Clip 2',
	payload: {
		fileName: 'clips/bar.mp4'
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
		assert.equal(result.source, 'core')
		assert.equal(result.requirements.length, 1)
		assert.equal(result.requirements[0]?.ready, true)
		assert.equal(result.requirements[0]?.source, 'core')
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
		assert.equal(result.source, 'core')
		assert.match(result.requirements[0]?.reason ?? '', /playout system/)
		assert.equal(result.requirements[0]?.source, 'core')
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
		assert.equal(result.source, 'fs')
		assert.equal(result.requirements[0]?.source, 'fs')
	})
})

describe('evaluateRundownReadiness provenance by Core result shape', () => {
	it('tags pieces as core when Core returns a populated status map', async () => {
		const statuses = new Map<string, CorePieceContentStatus>([
			[
				'piece-1',
				{ pieceExternalId: 'piece-1', statusCode: 0, ready: true }
			],
			[
				'piece-2',
				{ pieceExternalId: 'piece-2', statusCode: 0, ready: true }
			]
		])

		const readiness = await evaluateRundownReadiness(
			[PIECE_WITH_MEDIA, PIECE_TWO],
			[VIDEO_MANIFEST],
			statuses
		)

		assert.equal(readiness.pieces['piece-1']?.source, 'core')
		assert.equal(readiness.pieces['piece-2']?.source, 'core')
		assert.deepEqual(countReadinessProvenance(readiness), {
			piecesFromCore: 2,
			piecesFromFsFallback: 0
		})
	})

	it('tags pieces as fs when Core returns an empty status map (ambiguous empty)', async () => {
		const readiness = await evaluateRundownReadiness(
			[PIECE_WITH_MEDIA, PIECE_TWO],
			[VIDEO_MANIFEST],
			new Map()
		)

		assert.equal(readiness.pieces['piece-1']?.source, 'fs')
		assert.equal(readiness.pieces['piece-2']?.source, 'fs')
		assert.deepEqual(countReadinessProvenance(readiness), {
			piecesFromCore: 0,
			piecesFromFsFallback: 2
		})
	})

	it('tags pieces as fs when Core is disconnected (no status map)', async () => {
		// Mirrors coreCallSource === 'core-disconnected' — caller passes no map.
		const readiness = await evaluateRundownReadiness(
			[PIECE_WITH_MEDIA],
			[VIDEO_MANIFEST],
			undefined
		)

		assert.equal(readiness.pieces['piece-1']?.source, 'fs')
		assert.deepEqual(countReadinessProvenance(readiness), {
			piecesFromCore: 0,
			piecesFromFsFallback: 1
		})
	})

	it('tags pieces as fs when Core errored (no status map)', async () => {
		// Mirrors coreCallSource === 'core-error' — caller passes no map.
		const readiness = await evaluateRundownReadiness(
			[PIECE_WITH_MEDIA],
			[VIDEO_MANIFEST],
			undefined
		)

		assert.equal(readiness.pieces['piece-1']?.source, 'fs')
		assert.equal(readiness.pieces['piece-1']?.requirements[0]?.source, 'fs')
	})
})

describe('evaluatePieceReadiness master-only filesystem path', () => {
	it('treats media as ready when the master file exists even if a former CEF .webm sibling is absent', async () => {
		const checked: string[] = []

		const result = await evaluatePieceReadiness(
			PIECE_WITH_MEDIA,
			[VIDEO_MANIFEST],
			{
				checkFile: async (absolutePath) => {
					checked.push(absolutePath)
					if (absolutePath.endsWith('.webm')) {
						return false
					}
					return absolutePath.endsWith('clips/foo.mp4') || absolutePath.includes('foo.mp4')
				}
			}
		)

		assert.equal(result.ready, true)
		assert.equal(result.source, 'fs')
		assert.equal(result.requirements.length, 1)
		assert.equal(result.requirements[0]?.ready, true)
		assert.equal(
			checked.some((p) => p.endsWith('.webm')),
			false,
			'former CEF .webm sibling must not be required for readiness'
		)
	})

	it('reports not ready when the master media file is missing', async () => {
		const result = await evaluatePieceReadiness(
			PIECE_WITH_MEDIA,
			[VIDEO_MANIFEST],
			{
				checkFile: async () => false
			}
		)

		assert.equal(result.ready, false)
		assert.equal(result.source, 'fs')
		assert.match(result.requirements[0]?.reason ?? '', /missing/i)
	})
})
