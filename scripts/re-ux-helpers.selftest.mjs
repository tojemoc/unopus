/**
 * Lightweight assertions for RE UX helpers (no vitest harness required).
 */
import assert from 'node:assert/strict'

function snapScriptOffsetToWordBoundary(script, offset) {
	const clamped = Math.max(0, Math.min(script.length, Math.floor(offset)))
	if (clamped <= 0 || clamped >= script.length) return clamped
	if (/\s/.test(script[clamped] ?? '') || /\s/.test(script[clamped - 1] ?? '')) {
		return clamped
	}
	let left = clamped
	while (left > 0 && !/\s/.test(script[left - 1] ?? '')) left--
	let right = clamped
	while (right < script.length && !/\s/.test(script[right] ?? '')) right++
	return clamped - left <= right - clamped ? left : right
}

const sample = 'Dobrý večer. Premiér Fico'
assert.equal(snapScriptOffsetToWordBoundary(sample, 0), 0)
assert.equal(snapScriptOffsetToWordBoundary(sample, sample.length), sample.length)
const midVecer = sample.indexOf('večer') + 2
const snapped = snapScriptOffsetToWordBoundary(sample, midVecer)
assert.ok(snapped === sample.indexOf('večer') || snapped === sample.indexOf('večer') + 'večer'.length)

function toolbarManifests(manifests, includeTechOnly) {
	return manifests
		.filter((m) => m.entityType === 'piece')
		.filter((m) => m.showInToolbar !== false)
		.filter((m) => includeTechOnly || !m.techOnly)
		.filter((m) => !m.toolbarGroup)
}
const manifests = [
	{ id: 'video', entityType: 'piece' },
	{ id: 'camera', entityType: 'piece', techOnly: true },
	{ id: 'l3d-tema', entityType: 'piece', showInToolbar: false, toolbarGroup: 'l3d' },
	{ id: 'source', entityType: 'piece' }
]
assert.deepEqual(
	toolbarManifests(manifests, false).map((m) => m.id),
	['video', 'source']
)
assert.deepEqual(
	toolbarManifests(manifests, true).map((m) => m.id),
	['video', 'camera', 'source']
)

console.log('re-ux-helpers: ok')
