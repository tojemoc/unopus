import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveBridgeTemplateSrc } from './gfxPreviewBridge.js'

const pageHref = 'https://duopus.tjm.sk/app/backend/demo-assets/_gfx-preview-bridge.html?template=gfx%2Fl3d-syn.html'
const pageOrigin = 'https://duopus.tjm.sk'

describe('resolveBridgeTemplateSrc', () => {
	it('allows same-origin relative template paths', () => {
		const resolved = resolveBridgeTemplateSrc('gfx/l3d-syn.html', pageHref, pageOrigin)
		assert.equal(
			resolved,
			'https://duopus.tjm.sk/app/backend/demo-assets/gfx/l3d-syn.html'
		)
	})

	it('rejects javascript: template values', () => {
		assert.equal(
			resolveBridgeTemplateSrc('javascript:alert(1)', pageHref, pageOrigin),
			null
		)
	})

	it('rejects cross-origin absolute template URLs', () => {
		assert.equal(
			resolveBridgeTemplateSrc('https://evil.example/gfx/l3d-syn.html', pageHref, pageOrigin),
			null
		)
	})

	it('rejects empty template values', () => {
		assert.equal(resolveBridgeTemplateSrc('', pageHref, pageOrigin), null)
		assert.equal(resolveBridgeTemplateSrc(null, pageHref, pageOrigin), null)
	})
})
