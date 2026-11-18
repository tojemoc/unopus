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

	it('rejects dot-only template ids', () => {
		assert.equal(sanitizeGfxTemplateId('.'), '')
		assert.equal(sanitizeGfxTemplateId('..'), '')
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
	const previousIngest = process.env.INGEST_MEDIA_ROOT
	const previousDemoAssets = process.env.DEMO_ASSETS_ROOT
	let tempRoot = ''
	let tempIngestRoot = ''

	afterEach(() => {
		if (previousRoot === undefined) {
			delete process.env.GFX_TEMPLATES_ROOT
		} else {
			process.env.GFX_TEMPLATES_ROOT = previousRoot
		}
		if (previousIngest === undefined) {
			delete process.env.INGEST_MEDIA_ROOT
		} else {
			process.env.INGEST_MEDIA_ROOT = previousIngest
		}
		if (previousDemoAssets === undefined) {
			delete process.env.DEMO_ASSETS_ROOT
		} else {
			process.env.DEMO_ASSETS_ROOT = previousDemoAssets
		}
		if (tempRoot) {
			fs.rmSync(tempRoot, { recursive: true, force: true })
			tempRoot = ''
		}
		if (tempIngestRoot) {
			fs.rmSync(tempIngestRoot, { recursive: true, force: true })
			tempIngestRoot = ''
		}
	})

	it('prefers gfx/{template}.html over folder stubs', () => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-'))
		fs.mkdirSync(path.join(tempRoot, 'gfx'), { recursive: true })
		fs.writeFileSync(path.join(tempRoot, 'gfx', 'l3d-syn.html'), '<html></html>')
		fs.mkdirSync(path.join(tempRoot, 'l3d-syn'), { recursive: true })
		fs.writeFileSync(path.join(tempRoot, 'l3d-syn', 'index.html'), '<html></html>')

		process.env.GFX_TEMPLATES_ROOT = tempRoot
		process.env.DEMO_ASSETS_ROOT = tempRoot
		const resolved = resolveGfxTemplate('l3d-syn')
		assert.deepEqual(resolved, { relativePath: 'gfx/l3d-syn.html', mode: 'caspar' })
	})

	it('falls back to {template}/index.html stubs', () => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-'))
		fs.mkdirSync(path.join(tempRoot, 'l3d-tema'), { recursive: true })
		fs.writeFileSync(path.join(tempRoot, 'l3d-tema', 'index.html'), '<html></html>')

		process.env.GFX_TEMPLATES_ROOT = tempRoot
		process.env.DEMO_ASSETS_ROOT = tempRoot
		const resolved = resolveGfxTemplate('l3d-tema')
		assert.deepEqual(resolved, { relativePath: 'l3d-tema/index.html', mode: 'query' })
	})

	it('resolves manifest aliases to real caspar templates before bundled stubs', () => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-alias-'))
		// Bundled demo-assets ships a `weather/index.html` stub — the checkout's
		// real `gfx/pocasie.html` must still win for the `weather` manifest id.
		const gfxTemplatesDir = path.join(tempRoot, 'template', 'gfx')
		fs.mkdirSync(gfxTemplatesDir, { recursive: true })
		fs.writeFileSync(path.join(gfxTemplatesDir, 'pocasie.html'), '<html>caspar</html>')

		process.env.DEMO_ASSETS_ROOT = tempRoot

		const resolved = resolveGfxTemplate('weather')
		assert.deepEqual(resolved, { relativePath: 'gfx/pocasie.html', mode: 'caspar' })
	})

	it('lets an explicit root override a checkout alias for the requested id', () => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-alias-explicit-'))
		tempIngestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-alias-checkout-'))

		fs.mkdirSync(path.join(tempRoot, 'weather'), { recursive: true })
		fs.writeFileSync(path.join(tempRoot, 'weather', 'index.html'), '<html>stub</html>')

		const gfxTemplatesDir = path.join(tempIngestRoot, 'template', 'gfx')
		fs.mkdirSync(gfxTemplatesDir, { recursive: true })
		fs.writeFileSync(path.join(gfxTemplatesDir, 'pocasie.html'), '<html>caspar</html>')

		process.env.GFX_TEMPLATES_ROOT = tempRoot
		process.env.DEMO_ASSETS_ROOT = tempIngestRoot

		const resolved = resolveGfxTemplate('weather')
		assert.deepEqual(resolved, { relativePath: 'weather/index.html', mode: 'query' })
	})

	it('prefers caspar candidate across roots over index.html in a higher-priority root', () => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-stub-'))
		tempIngestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-ingest-'))

		fs.mkdirSync(path.join(tempRoot, 'l3d-syn'), { recursive: true })
		fs.writeFileSync(path.join(tempRoot, 'l3d-syn', 'index.html'), '<html>stub</html>')

		const gfxTemplatesDir = path.join(tempIngestRoot, 'gfx-templates', 'gfx')
		fs.mkdirSync(gfxTemplatesDir, { recursive: true })
		fs.writeFileSync(path.join(gfxTemplatesDir, 'l3d-syn.html'), '<html>caspar</html>')

		process.env.GFX_TEMPLATES_ROOT = tempRoot
		process.env.INGEST_MEDIA_ROOT = tempIngestRoot
		process.env.DEMO_ASSETS_ROOT = tempRoot

		const resolved = resolveGfxTemplate('l3d-syn')
		assert.deepEqual(resolved, { relativePath: 'gfx/l3d-syn.html', mode: 'caspar' })
	})

	it('discovers caspar templates inside the demo-assets checkout', () => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-preview-checkout-'))
		const gfxTemplatesDir = path.join(tempRoot, 'template', 'gfx')
		fs.mkdirSync(gfxTemplatesDir, { recursive: true })
		fs.writeFileSync(path.join(gfxTemplatesDir, 'l3d-odporucanie.html'), '<html>caspar</html>')

		process.env.DEMO_ASSETS_ROOT = tempRoot

		const resolved = resolveGfxTemplate('l3d-odporucanie')
		assert.deepEqual(resolved, { relativePath: 'gfx/l3d-odporucanie.html', mode: 'caspar' })
	})
})
