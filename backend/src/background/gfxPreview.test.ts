import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'path'
import { afterEach, describe, it } from 'node:test'
import {
	buildCasparTemplateDataXml,
	resolveGfxTemplate,
	sanitizeGfxTemplateId
} from './gfxPreview.js'

describe('sanitizeGfxTemplateId', () => {
	it('strips path segments', () => {
		assert.equal(sanitizeGfxTemplateId('gfx/l3d-headline'), 'gfxl3d-headline')
		assert.equal(sanitizeGfxTemplateId('  l3d-syn  '), 'l3d-syn')
	})
})

describe('buildCasparTemplateDataXml', () => {
	it('builds componentData nodes for each payload field', () => {
		const xml = buildCasparTemplateDataXml({ name: 'Peter Pellegrini', function: 'Prezident' })
		assert.match(xml, /<templateData>/)
		assert.match(xml, /id="name"/)
		assert.match(xml, /value="Peter Pellegrini"/)
		assert.match(xml, /id="function"/)
		assert.match(xml, /value="Prezident"/)
	})

	it('escapes XML special characters', () => {
		const xml = buildCasparTemplateDataXml({ headline: 'A & B <test>' })
		assert.match(xml, /value="A &amp; B &lt;test&gt;"/)
	})

	it('skips empty values', () => {
		const xml = buildCasparTemplateDataXml({ name: 'Ok', title: '', role: null })
		assert.match(xml, /id="name"/)
		assert.doesNotMatch(xml, /id="title"/)
		assert.doesNotMatch(xml, /id="role"/)
	})
})

describe('resolveGfxTemplate', () => {
	const previousRoot = process.env.GFX_TEMPLATES_ROOT
	let tempRoot = ''

	afterEach(() => {
		if (previousRoot === undefined) {
			delete process.env.GFX_TEMPLATES_ROOT
		} else {
			process.env.GFX_TEMPLATES_ROOT = previousRoot
		}
		if (tempRoot) {
			fs.rmSync(tempRoot, { recursive: true, force: true })
			tempRoot = ''
		}
	})

	it('prefers gfx/{template}.html over folder stubs', () => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-'))
		fs.mkdirSync(path.join(tempRoot, 'gfx'), { recursive: true })
		fs.writeFileSync(path.join(tempRoot, 'gfx', 'l3d-syn.html'), '<html></html>')
		fs.mkdirSync(path.join(tempRoot, 'l3d-syn'), { recursive: true })
		fs.writeFileSync(path.join(tempRoot, 'l3d-syn', 'index.html'), '<html></html>')

		process.env.GFX_TEMPLATES_ROOT = tempRoot
		const resolved = resolveGfxTemplate('l3d-syn')
		assert.deepEqual(resolved, { relativePath: 'gfx/l3d-syn.html', mode: 'caspar' })
	})

	it('falls back to {template}/index.html stubs', () => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-'))
		fs.mkdirSync(path.join(tempRoot, 'l3d-tema'), { recursive: true })
		fs.writeFileSync(path.join(tempRoot, 'l3d-tema', 'index.html'), '<html></html>')

		process.env.GFX_TEMPLATES_ROOT = tempRoot
		const resolved = resolveGfxTemplate('l3d-tema')
		assert.deepEqual(resolved, { relativePath: 'l3d-tema/index.html', mode: 'query' })
	})
})
