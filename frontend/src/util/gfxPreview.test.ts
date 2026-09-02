import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { isSameOriginPreviewBase } from '../lib/isSameOriginPreviewBase.js'

describe('isSameOriginPreviewBase', () => {
	const previousWindow = globalThis.window

	beforeEach(() => {
		globalThis.window = {
			location: {
				origin: 'https://duopus.tjm.sk',
				href: 'https://duopus.tjm.sk/app/backend/'
			}
		} as Window & typeof globalThis
	})

	afterEach(() => {
		globalThis.window = previousWindow
	})

	it('accepts same-origin absolute http(s) URLs', () => {
		assert.equal(isSameOriginPreviewBase('https://duopus.tjm.sk/demo-assets'), true)
	})

	it('rejects cross-origin absolute http(s) URLs', () => {
		assert.equal(isSameOriginPreviewBase('https://other.example/demo-assets'), false)
	})

	it('accepts same-origin relative paths', () => {
		assert.equal(isSameOriginPreviewBase('/demo-assets'), true)
		assert.equal(isSameOriginPreviewBase('demo-assets'), true)
	})

	it('rejects leading-slash paths that resolve to a foreign origin', () => {
		assert.equal(isSameOriginPreviewBase('/\\attacker.example'), false)
	})
})
