import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	isClipPreviewPathField,
	isPrimaryClipField,
	resolveClipPreviewPath,
	resolvePieceName
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
	subdir: 'clips',
	includeInName: true
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

describe('resolvePieceName — ILU from filename', () => {
	const iluManifest = {
		id: 'doublebox-ilu',
		entityType: 'piece',
		name: 'ILU (DoubleBox)',
		shortName: 'ILU',
		includeTypeInName: false,
		payload: [
			{ ...iluFileField },
			{ id: 'text', label: 'Label', type: 'string' as const },
			{ ...volumeField, default: 0.5 }
		]
	}

	it('uses the media basename as the whole piece name', () => {
		assert.equal(
			resolvePieceName(iluManifest as never, {
				iluFile: 'clips/ILU_TARABA.mp4',
				text: 'ignored label',
				volume: 0.5
			}),
			'ILU_TARABA.mp4'
		)
	})

	it('falls back to the type name when no clip is selected', () => {
		assert.equal(resolvePieceName(iluManifest as never, { text: 'label only' }), 'ILU (DoubleBox)')
	})
})

describe('resolvePieceName — SRC default prefix', () => {
	const srcManifest = {
		id: 'source',
		entityType: 'piece',
		name: 'Source pill',
		shortName: 'SRC',
		includeTypeInName: true,
		payload: [
			{
				id: 'source',
				label: 'Source',
				type: 'string' as const,
				includeInName: true,
				default: 'Zdroj: '
			}
		]
	}

	it('includes the Zdroj prefix in the derived name', () => {
		assert.equal(
			resolvePieceName(srcManifest as never, { source: 'Zdroj: TASR' }),
			'SRC: Zdroj: TASR'
		)
	})
})
