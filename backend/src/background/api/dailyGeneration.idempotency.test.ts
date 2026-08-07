import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../db.js'
import {
	DAILY_GENERATION_LEASE_MS,
	generateDailyRundownIfNeeded,
	mintIdempotencyKey,
	readDailyGenerationRow,
	reconcileDailyGenerationReservation,
	reconcileForeignTimezoneInProgress
} from './dailyGeneration.js'
import { mutations as rundownMutations } from './rundowns.js'

async function ensureTemplate(id: string, name: string) {
	const existing = await rundownMutations.readOne(id)
	if (existing.result) {
		if (!existing.result.isTemplate) {
			await rundownMutations.update({ ...existing.result, isTemplate: true, sync: false })
		}
		return existing.result
	}
	const { result, error } = await rundownMutations.create({
		id,
		name,
		playlistId: null,
		sync: false,
		isTemplate: true,
		payload: {}
	})
	if (error || !result) throw error ?? new Error('failed to create template')
	return result
}

function countRundownsForTemplate(templateId: string): number {
	const rows = db
		.prepare(
			`
			SELECT id, document FROM rundowns
			WHERE id != ?
		`
		)
		.all(templateId) as Array<{ id: string; document: string }>
	// Count clones that are not templates (daily copies clear isTemplate)
	return rows.filter((row) => {
		const doc = JSON.parse(row.document) as { isTemplate?: boolean; name?: string }
		return doc.isTemplate !== true
	}).length
}

function insertReservation(row: {
	sourceTemplateId: string
	generatedDate: string
	generatingTimezone: string
	attemptId: string
	idempotencyKey: string
	leaseExpiresAt: string
	rundownId: string | null
	status: 'in_progress' | 'completed' | 'failed'
}): void {
	db.prepare(
		`
		INSERT OR REPLACE INTO dailyGenerations (
			sourceTemplateId, generatedDate, generatingTimezone,
			attemptId, idempotencyKey, leaseExpiresAt, rundownId, status
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	).run(
		row.sourceTemplateId,
		row.generatedDate,
		row.generatingTimezone,
		row.attemptId,
		row.idempotencyKey,
		row.leaseExpiresAt,
		row.rundownId,
		row.status
	)
}

describe('daily generation idempotency', () => {
	const templateId = 'test-daily-template'
	const timezone = 'Europe/Bratislava'

	before(async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		await ensureTemplate(templateId, 'Daily Template')
	})

	after(() => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
	})

	it('same template + same day does not produce two rundowns', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const rundownCountBefore = countRundownsForTemplate(templateId)
		const now = new Date('2024-06-15T10:00:00.000Z') // 12:00 Bratislava
		const settings = {
			dailyTemplateRundownId: templateId,
			dailyCloneTime: '08:00',
			dailyCloneTimezone: timezone
		}

		const first = await generateDailyRundownIfNeeded(templateId, { now, settings, force: true })
		const second = await generateDailyRundownIfNeeded(templateId, { now, settings, force: true })

		assert.ok(first?.rundownId)
		assert.equal(second?.rundownId, first?.rundownId)
		assert.equal(second?.created, false)
		assert.equal(countRundownsForTemplate(templateId), rundownCountBefore + 1)
	})

	it('different day produces a new rundown', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const settings = {
			dailyTemplateRundownId: templateId,
			dailyCloneTime: '08:00',
			dailyCloneTimezone: timezone
		}
		const day1 = await generateDailyRundownIfNeeded(templateId, {
			now: new Date('2024-06-15T10:00:00.000Z'),
			settings,
			force: true
		})
		const day2 = await generateDailyRundownIfNeeded(templateId, {
			now: new Date('2024-06-16T10:00:00.000Z'),
			settings,
			force: true
		})
		assert.ok(day1?.rundownId)
		assert.ok(day2?.rundownId)
		assert.notEqual(day1?.rundownId, day2?.rundownId)
		assert.equal(day1?.generatedDate, '2024-06-15')
		assert.equal(day2?.generatedDate, '2024-06-16')
	})

	it('delayed tick after dailyCloneTime still generates when marker absent', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const settings = {
			dailyTemplateRundownId: templateId,
			dailyCloneTime: '08:00',
			dailyCloneTimezone: timezone
		}
		// 09:05 local — past 08:00
		const result = await generateDailyRundownIfNeeded(templateId, {
			now: new Date('2024-06-20T07:05:00.000Z'),
			settings,
			force: false
		})
		assert.ok(result?.created)
		assert.equal(result?.generatedDate, '2024-06-20')
	})

	it('concurrent generate joins the same reservation', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const settings = {
			dailyTemplateRundownId: templateId,
			dailyCloneTime: '08:00',
			dailyCloneTimezone: timezone
		}
		const now = new Date('2024-08-01T10:00:00.000Z')
		const [a, b] = await Promise.all([
			generateDailyRundownIfNeeded(templateId, { now, settings, force: true }),
			generateDailyRundownIfNeeded(templateId, { now, settings, force: true })
		])
		assert.ok(a?.rundownId)
		assert.equal(a?.rundownId, b?.rundownId)
		assert.equal([a?.created, b?.created].filter(Boolean).length, 1)
	})

	it('does not generate before dailyCloneTime unless forced', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const settings = {
			dailyTemplateRundownId: templateId,
			dailyCloneTime: '08:00',
			dailyCloneTimezone: timezone
		}
		const result = await generateDailyRundownIfNeeded(templateId, {
			now: new Date('2024-06-20T05:00:00.000Z'), // 07:00 Bratislava
			settings,
			force: false
		})
		assert.equal(result, null)
	})

	it('reconcile finds rundown by idempotencyKey before failing expired lease', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const generatedDate = '2024-07-01'
		const attemptId = 'attempt-reconcile-1'
		const idempotencyKey = mintIdempotencyKey(templateId, generatedDate, timezone, attemptId)

		const { result: clone } = await rundownMutations.createRundownCopy({
			id: templateId,
			preserveTemplate: false,
			attemptId,
			idempotencyKey
		})
		assert.ok(clone?.rundown)

		insertReservation({
			sourceTemplateId: templateId,
			generatedDate,
			generatingTimezone: timezone,
			attemptId,
			idempotencyKey,
			leaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
			rundownId: null,
			status: 'in_progress'
		})

		const row = readDailyGenerationRow(templateId, generatedDate, timezone)!
		const reconciled = reconcileDailyGenerationReservation(row, new Date())
		assert.equal(reconciled.status, 'completed')
		assert.equal(reconciled.rundownId, clone!.rundown.id)
	})

	it('expired lease with no rundown transitions to failed; retry uses failed→in_progress', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const generatedDate = '2024-07-02'
		const attemptId = 'attempt-fail-1'
		const idempotencyKey = mintIdempotencyKey(templateId, generatedDate, timezone, attemptId)

		insertReservation({
			sourceTemplateId: templateId,
			generatedDate,
			generatingTimezone: timezone,
			attemptId,
			idempotencyKey,
			leaseExpiresAt: new Date(Date.now() - 60_000).toISOString(),
			rundownId: null,
			status: 'in_progress'
		})

		const failed = reconcileDailyGenerationReservation(
			readDailyGenerationRow(templateId, generatedDate, timezone)!,
			new Date()
		)
		assert.equal(failed.status, 'failed')
		assert.equal(failed.rundownId, null)

		const settings = {
			dailyTemplateRundownId: templateId,
			dailyCloneTime: '08:00',
			dailyCloneTimezone: timezone
		}
		const retried = await generateDailyRundownIfNeeded(templateId, {
			now: new Date(`${generatedDate}T10:00:00.000Z`),
			settings,
			force: true
		})
		assert.ok(retried?.rundownId)
		assert.equal(retried?.status, 'completed')
		const row = readDailyGenerationRow(templateId, generatedDate, timezone)!
		assert.equal(row.status, 'completed')
		assert.notEqual(row.attemptId, attemptId)
	})

	it('unexpired lease without rundown stays in_progress (no clear without reconcile)', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const generatedDate = '2024-07-03'
		const attemptId = 'attempt-live-1'
		const idempotencyKey = mintIdempotencyKey(templateId, generatedDate, timezone, attemptId)

		insertReservation({
			sourceTemplateId: templateId,
			generatedDate,
			generatingTimezone: timezone,
			attemptId,
			idempotencyKey,
			leaseExpiresAt: new Date(Date.now() + DAILY_GENERATION_LEASE_MS).toISOString(),
			rundownId: null,
			status: 'in_progress'
		})

		const row = readDailyGenerationRow(templateId, generatedDate, timezone)!
		const reconciled = reconcileDailyGenerationReservation(row, new Date())
		assert.equal(reconciled.status, 'in_progress')
		assert.equal(reconciled.rundownId, null)
	})

	it('timezone change: old-zone in_progress is canceled before new-zone generation; completed ignored', async () => {
		db.prepare(`DELETE FROM dailyGenerations WHERE sourceTemplateId = ?`).run(templateId)
		const generatedDate = '2024-07-04'
		const oldZone = 'America/New_York'
		const newZone = timezone

		insertReservation({
			sourceTemplateId: templateId,
			generatedDate,
			generatingTimezone: oldZone,
			attemptId: 'old-zone-attempt',
			idempotencyKey: mintIdempotencyKey(templateId, generatedDate, oldZone, 'old-zone-attempt'),
			leaseExpiresAt: new Date(Date.now() + DAILY_GENERATION_LEASE_MS).toISOString(),
			rundownId: null,
			status: 'in_progress'
		})

		insertReservation({
			sourceTemplateId: templateId,
			generatedDate: '2024-07-03',
			generatingTimezone: oldZone,
			attemptId: 'old-completed',
			idempotencyKey: mintIdempotencyKey(templateId, '2024-07-03', oldZone, 'old-completed'),
			leaseExpiresAt: new Date().toISOString(),
			rundownId: 'some-old-rundown',
			status: 'completed'
		})

		reconcileForeignTimezoneInProgress(templateId, newZone, new Date())

		const canceled = readDailyGenerationRow(templateId, generatedDate, oldZone)!
		assert.equal(canceled.status, 'failed')

		const completedStill = readDailyGenerationRow(templateId, '2024-07-03', oldZone)!
		assert.equal(completedStill.status, 'completed')

		const settings = {
			dailyTemplateRundownId: templateId,
			dailyCloneTime: '08:00',
			dailyCloneTimezone: newZone
		}
		const created = await generateDailyRundownIfNeeded(templateId, {
			now: new Date('2024-07-04T10:00:00.000Z'),
			settings,
			force: true
		})
		assert.ok(created?.created)
		assert.equal(created?.timezone, newZone)
		// Old-zone completed does not satisfy new zone
		const newZoneRow = readDailyGenerationRow(templateId, created!.generatedDate, newZone)!
		assert.equal(newZoneRow.status, 'completed')
	})

	it('rejects non-template rundown before cloning', async () => {
		const { result: nonTemplate } = await rundownMutations.create({
			name: 'Not a template',
			playlistId: null,
			sync: false,
			isTemplate: false,
			payload: {}
		})
		assert.ok(nonTemplate)
		await assert.rejects(
			() =>
				generateDailyRundownIfNeeded(nonTemplate!.id, {
					force: true,
					settings: {
						dailyTemplateRundownId: nonTemplate!.id,
						dailyCloneTime: '08:00',
						dailyCloneTimezone: timezone
					}
				}),
			/not a template/i
		)
	})
})
