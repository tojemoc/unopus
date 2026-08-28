import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { getPreviewBaseUrl } from './media.js'

describe('getPreviewBaseUrl', () => {
	const originalPreviewBaseUrl = process.env.PREVIEW_BASE_URL

	afterEach(() => {
		if (originalPreviewBaseUrl === undefined) {
			delete process.env.PREVIEW_BASE_URL
		} else {
			process.env.PREVIEW_BASE_URL = originalPreviewBaseUrl
		}
	})

	it('falls back to default when PREVIEW_BASE_URL normalizes to an invalid suffix-only value', () => {
		process.env.PREVIEW_BASE_URL = '?cache=/'
		assert.equal(getPreviewBaseUrl(), '/demo-assets')
	})
})
