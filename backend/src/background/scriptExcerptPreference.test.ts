import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveShowPartScriptExcerpt } from './scriptExcerptPreference.js'

describe('resolveShowPartScriptExcerpt', () => {
	it('defaults ON when user and site are unset', () => {
		assert.equal(resolveShowPartScriptExcerpt(undefined, undefined), true)
		assert.equal(resolveShowPartScriptExcerpt(null, null), true)
	})

	it('uses site setting as default when user has no override', () => {
		assert.equal(resolveShowPartScriptExcerpt(null, true), true)
		assert.equal(resolveShowPartScriptExcerpt(undefined, false), false)
	})

	it('lets the account toggle OFF (or ON) over the site default', () => {
		assert.equal(resolveShowPartScriptExcerpt(false, true), false)
		assert.equal(resolveShowPartScriptExcerpt(true, false), true)
	})
})
