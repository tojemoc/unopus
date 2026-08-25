import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isValidHttpUrl, isValidPreviewBaseUrl, normalizeBaseUrl } from './urlHelpers.js'

describe('preview base URL', () => {
	it('accepts same-origin /demo-assets and absolute http(s)', () => {
		assert.equal(isValidPreviewBaseUrl('/demo-assets'), true)
		assert.equal(isValidPreviewBaseUrl('https://duopus.tjm.sk/demo-assets'), true)
		assert.equal(isValidHttpUrl('/demo-assets'), false)
	})

	it('rejects protocol-relative and empty values', () => {
		assert.equal(isValidPreviewBaseUrl('//evil.example/demo-assets'), false)
		assert.equal(isValidPreviewBaseUrl(''), false)
		assert.equal(normalizeBaseUrl('/demo-assets/'), '/demo-assets')
	})
})
