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

	it('keeps same-origin root as / after trimming trailing slashes', () => {
		assert.equal(normalizeBaseUrl('/'), '/')
		assert.equal(normalizeBaseUrl('///'), '/')
		assert.equal(normalizeBaseUrl(''), '')
		assert.equal(isValidPreviewBaseUrl(normalizeBaseUrl('/')), true)
	})

	it('trims trailing slashes from the path only, not query or fragment', () => {
		assert.equal(normalizeBaseUrl('/demo-assets?cache=/'), '/demo-assets?cache=/')
		assert.equal(normalizeBaseUrl('/demo-assets/#/'), '/demo-assets#/')
		assert.equal(normalizeBaseUrl('/demo-assets/foo/?q=1'), '/demo-assets/foo?q=1')
	})

	it('rejects suffix-only query or fragment inputs', () => {
		for (const input of ['?cache=/', '#/', '?q=1', '#frag']) {
			assert.equal(normalizeBaseUrl(input), '')
			assert.equal(isValidPreviewBaseUrl(input), false)
			assert.equal(isValidPreviewBaseUrl(normalizeBaseUrl(input)), false)
		}
	})
})
