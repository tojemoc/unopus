import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	isClipPreviewPathField,
	isPrimaryClipField,
	resolveClipPreviewPath
} from './pieceName.js'

const volumeField = {
	id: 'volume',
	label: 'ILU volume (0–1)',
	type: 'number' as const
}

const iluFileField = {
	id: 'iluFile',
	label: 'ILU clip',
	type: 'mediaPick' as const,
	subdir: 'clips'
}

describe('isPrimaryClipField vs isClipPreviewPathField', () => {
	it('includes volume in UI clip grouping but not in preview-path eligibility', () => {
		assert.equal(isPrimaryClipField(volumeField as never), true)
		assert.equal(isClipPreviewPathField(volumeField as never), false)
		assert.equal(isPrimaryClipField(iluFileField as never), true)
		assert.equal(isClipPreviewPathField(iluFileField as never), true)
	})
})

describe('resolveClipPreviewPath', () => {
	const headlineManifest = {
		id: 'headline',
		entityType: 'piece',
		name: 'ILU Headline',
		// volume listed first to prove order alone cannot select it as a path
		payload: [volumeField, iluFileField]
	}

	it('never treats a string volume as a media preview path', () => {
		assert.equal(resolveClipPreviewPath(headlineManifest as never, { volume: '0.5' }), undefined)
		assert.equal(
			resolveClipPreviewPath(headlineManifest as never, {
				volume: '0.5',
				iluFile: 'clips/HEADLINE1.mov'
			}),
			'clips/HEADLINE1.mov'
		)
	})
})
