import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	aggregateCoreVerdictsForKey,
	normalizeMediaMatchKey,
	type CoreVerdictForJoin
} from './mediaPathKey.js'

describe('normalizeMediaMatchKey', () => {
	it('normalizes slash variants and case', () => {
		assert.equal(normalizeMediaMatchKey('clips\\a.mp4'), 'clips/a.mp4')
		assert.equal(normalizeMediaMatchKey('clips/a.mp4'), 'clips/a.mp4')
		assert.equal(normalizeMediaMatchKey('Clips/A.MP4'), 'clips/a.mp4')
	})

	it('rejects UNC and protocol URLs without collapsing', () => {
		assert.equal(normalizeMediaMatchKey('\\\\server\\share\\clip.mp4'), null)
		assert.equal(normalizeMediaMatchKey('//server/share/clip.mp4'), null)
		assert.equal(normalizeMediaMatchKey('dshow://device'), null)
		assert.equal(normalizeMediaMatchKey('https://cdn.example/clip.mp4'), null)
	})

	it('strips drive-letter paths under ingest root and rejects outside root', () => {
		const root = 'C:/media'
		assert.equal(normalizeMediaMatchKey('C:\\media\\clips\\a.mp4', root), 'clips/a.mp4')
		assert.equal(normalizeMediaMatchKey('C:/media/clips/a.mp4', root), 'clips/a.mp4')
		assert.equal(normalizeMediaMatchKey('D:/other/clips/a.mp4', root), null)
		assert.equal(normalizeMediaMatchKey('C:/elsewhere/a.mp4', root), null)
	})

	it('strips POSIX absolute paths under ingest root and rejects outside root', () => {
		assert.equal(
			normalizeMediaMatchKey('/mnt/ingest/clips/a.mp4', '/mnt/ingest'),
			'clips/a.mp4'
		)
		assert.equal(
			normalizeMediaMatchKey('/mnt/ingest/clips/a.mp4', '/mnt/ingest/'),
			'clips/a.mp4'
		)
		assert.equal(normalizeMediaMatchKey('/mnt/ingest', '/mnt/ingest'), null)
		assert.equal(normalizeMediaMatchKey('/other/clips/a.mp4', '/mnt/ingest'), null)
	})

	it('strips a single leading slash on relative paths', () => {
		assert.equal(normalizeMediaMatchKey('/clips/a.mp4'), 'clips/a.mp4')
	})
})

describe('aggregateCoreVerdictsForKey', () => {
	it('conflict: any ready=false wins over ready=true → not-confirmed', () => {
		const verdicts: CoreVerdictForJoin[] = [
			{
				pieceExternalId: 'piece-a',
				fieldId: 'fileName',
				matchKey: 'clips/a.mp4',
				ready: true
			},
			{
				pieceExternalId: 'piece-b',
				fieldId: 'fileName',
				matchKey: 'clips/a.mp4',
				ready: false,
				reason: 'missing on playout'
			}
		]
		const result = aggregateCoreVerdictsForKey(verdicts)
		assert.equal(result.readiness, 'not-confirmed')
		assert.equal(result.reason, 'missing on playout')
	})

	it('stable reason ordering when two not-ready verdicts disagree', () => {
		const verdicts: CoreVerdictForJoin[] = [
			{
				pieceExternalId: 'piece-z',
				fieldId: 'fileName',
				matchKey: 'clips/a.mp4',
				ready: false,
				reason: 'reason-z'
			},
			{
				pieceExternalId: 'piece-a',
				fieldId: 'iluFile',
				matchKey: 'clips/a.mp4',
				ready: false,
				reason: 'reason-a'
			}
		]
		const result = aggregateCoreVerdictsForKey(verdicts)
		assert.equal(result.readiness, 'not-confirmed')
		assert.equal(result.reason, 'reason-a; reason-z')
	})

	it('all ready → confirmed; empty → unknown', () => {
		assert.equal(
			aggregateCoreVerdictsForKey([
				{
					pieceExternalId: 'p1',
					fieldId: 'fileName',
					matchKey: 'clips/a.mp4',
					ready: true
				}
			]).readiness,
			'confirmed'
		)
		const unknown = aggregateCoreVerdictsForKey([])
		assert.equal(unknown.readiness, 'unknown')
		assert.match(unknown.reason ?? '', /not yet confirmed/i)
	})
})
