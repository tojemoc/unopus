import { createHash, randomUUID } from 'node:crypto'
import { db } from '../db'
import type {
	ApplicationSettings,
	DailyGenerationResult,
	DailyGenerationRow,
	DailyGenerationStatus,
	DailyGenerationStatusResult,
	DBRundown,
	Rundown
} from '../interfaces'
import { mutations as rundownMutations } from './rundowns'
import { mutations as settingsMutations } from './settings'
import {
	DAILY_CLONE_TIME_RE,
	DEFAULT_DAILY_CLONE_TIMEZONE,
	getDailyGeneratedDate,
	hasDailyCloneTimePassed,
	isValidIanaTimeZone
} from '../dailyGenerationTime'

export {
	DEFAULT_DAILY_CLONE_TIMEZONE,
	DAILY_CLONE_TIME_RE,
	getDailyGeneratedDate,
	getLocalWallClockParts,
	hasDailyCloneTimePassed,
	isValidDailyCloneTime,
	isValidIanaTimeZone
} from '../dailyGenerationTime'

/** Lease duration for an in_progress reservation (restart-safe). */
export const DAILY_GENERATION_LEASE_MS = 10 * 60 * 1000
const JOIN_POLL_MS = 250
const JOIN_MAX_WAIT_MS = 30_000

type GenerationLogger = {
	info: (message: string, meta?: Record<string, unknown>) => void
	error: (message: string, meta?: Record<string, unknown>) => void
}

const defaultLogger: GenerationLogger = {
	info: (message, meta) => console.info(message, meta ?? {}),
	error: (message, meta) => console.error(message, meta ?? {})
}

export function mintIdempotencyKey(
	sourceTemplateId: string,
	generatedDate: string,
	generatingTimezone: string,
	attemptId: string
): string {
	return createHash('sha256')
		.update(`${sourceTemplateId}|${generatedDate}|${generatingTimezone}|${attemptId}`)
		.digest('hex')
}

function rowFromDb(raw: Record<string, unknown>): DailyGenerationRow {
	return {
		sourceTemplateId: String(raw.sourceTemplateId),
		generatedDate: String(raw.generatedDate),
		generatingTimezone: String(raw.generatingTimezone),
		attemptId: String(raw.attemptId),
		idempotencyKey: String(raw.idempotencyKey),
		leaseExpiresAt: String(raw.leaseExpiresAt),
		rundownId: raw.rundownId == null ? null : String(raw.rundownId),
		status: raw.status as DailyGenerationStatus
	}
}

export function readDailyGenerationRow(
	sourceTemplateId: string,
	generatedDate: string,
	generatingTimezone: string
): DailyGenerationRow | undefined {
	const raw = db
		.prepare(
			`
			SELECT *
			FROM dailyGenerations
			WHERE sourceTemplateId = ?
				AND generatedDate = ?
				AND generatingTimezone = ?
			LIMIT 1
		`
		)
		.get(sourceTemplateId, generatedDate, generatingTimezone) as Record<string, unknown> | undefined
	return raw ? rowFromDb(raw) : undefined
}

export function findRundownByIdempotencyKey(idempotencyKey: string): Rundown | undefined {
	const documents = db
		.prepare(
			`
			SELECT *
			FROM rundowns
			WHERE json_extract(document, '$.idempotencyKey') = ?
			LIMIT 1
		`
		)
		.all(idempotencyKey) as unknown as DBRundown[]

	const document = documents[0]
	if (!document) return undefined
	return {
		...JSON.parse(document.document),
		id: document.id,
		playlistId: document.playlistId ?? null
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function assertStatusCombination(row: Pick<DailyGenerationRow, 'status' | 'rundownId'>): void {
	if (row.status === 'completed' && !row.rundownId) {
		throw new Error('completed dailyGenerations row must have rundownId')
	}
	if ((row.status === 'in_progress' || row.status === 'failed') && row.rundownId) {
		throw new Error(`${row.status} dailyGenerations row must have null rundownId`)
	}
}

function updateDailyGenerationRow(
	sourceTemplateId: string,
	generatedDate: string,
	generatingTimezone: string,
	patch: Partial<
		Pick<
			DailyGenerationRow,
			'attemptId' | 'idempotencyKey' | 'leaseExpiresAt' | 'rundownId' | 'status'
		>
	>
): DailyGenerationRow {
	db.exec('BEGIN')
	try {
		const existing = readDailyGenerationRow(sourceTemplateId, generatedDate, generatingTimezone)
		if (!existing) {
			throw new Error('dailyGenerations row not found for update')
		}

		const next: DailyGenerationRow = {
			...existing,
			...patch
		}
		assertStatusCombination(next)

		// Enforce allowed transitions in app code.
		const from = existing.status
		const to = next.status
		const allowed =
			(from === to && from === 'in_progress') ||
			(from === 'in_progress' && (to === 'completed' || to === 'failed')) ||
			(from === 'failed' && (to === 'in_progress' || to === 'completed')) ||
			(from === 'completed' && to === 'completed')
		if (!allowed) {
			throw new Error(`Invalid dailyGenerations transition ${from} → ${to}`)
		}
		if (from === 'completed' && to !== 'completed') {
			throw new Error('completed dailyGenerations rows are immutable')
		}

		// Optimistic concurrency: require prior status (and attemptId for lease renewals).
		const isLeaseRenewal = from === 'in_progress' && to === 'in_progress'
		const result = isLeaseRenewal
			? db
					.prepare(
						`
					UPDATE dailyGenerations
					SET attemptId = ?,
						idempotencyKey = ?,
						leaseExpiresAt = ?,
						rundownId = ?,
						status = ?
					WHERE sourceTemplateId = ?
						AND generatedDate = ?
						AND generatingTimezone = ?
						AND status = ?
						AND attemptId = ?
				`
					)
					.run(
						next.attemptId,
						next.idempotencyKey,
						next.leaseExpiresAt,
						next.rundownId,
						next.status,
						sourceTemplateId,
						generatedDate,
						generatingTimezone,
						existing.status,
						existing.attemptId
					)
			: db
					.prepare(
						`
					UPDATE dailyGenerations
					SET attemptId = ?,
						idempotencyKey = ?,
						leaseExpiresAt = ?,
						rundownId = ?,
						status = ?
					WHERE sourceTemplateId = ?
						AND generatedDate = ?
						AND generatingTimezone = ?
						AND status = ?
				`
					)
					.run(
						next.attemptId,
						next.idempotencyKey,
						next.leaseExpiresAt,
						next.rundownId,
						next.status,
						sourceTemplateId,
						generatedDate,
						generatingTimezone,
						existing.status
					)

		if (result.changes !== 1) {
			throw new Error('dailyGenerations update conflict: expected exactly one row to change')
		}

		db.exec('COMMIT')
		return next
	} catch (e) {
		try {
			db.exec('ROLLBACK')
		} catch {
			// ignore rollback errors
		}
		throw e
	}
}

/**
 * Reconcile an in_progress (or failed-with-unknown-outcome) reservation by looking
 * up a rundown stamped with the reservation's idempotencyKey.
 * Never transitions to failed while the lease is still live and no rundown is found.
 */
export function reconcileDailyGenerationReservation(
	row: DailyGenerationRow,
	now: Date = new Date()
): DailyGenerationRow {
	if (row.status === 'completed') {
		return row
	}

	const found = findRundownByIdempotencyKey(row.idempotencyKey)
	if (found) {
		// Orphaned-clone recovery: failed or in_progress with a matching rundown → completed.
		return updateDailyGenerationRow(row.sourceTemplateId, row.generatedDate, row.generatingTimezone, {
			status: 'completed',
			rundownId: found.id
		})
	}

	if (row.status !== 'in_progress') {
		return row
	}

	if (new Date(row.leaseExpiresAt).getTime() > now.getTime()) {
		// Unknown outcome with live lease — leave in_progress.
		return row
	}

	return updateDailyGenerationRow(row.sourceTemplateId, row.generatedDate, row.generatingTimezone, {
		status: 'failed',
		rundownId: null
	})
}

/**
 * On timezone settings change (or scheduler start mismatch): reconcile/cancel every
 * in_progress reservation that was written under a different generatingTimezone so
 * an old-zone attempt cannot finish later while the new zone also clones.
 * Completed markers from other zones are left untouched (they neither block nor
 * satisfy the new zone).
 */
export function reconcileForeignTimezoneInProgress(
	sourceTemplateId: string,
	activeTimezone: string,
	now: Date = new Date()
): void {
	const rows = db
		.prepare(
			`
			SELECT *
			FROM dailyGenerations
			WHERE sourceTemplateId = ?
				AND generatingTimezone != ?
				AND status IN ('in_progress', 'failed')
		`
		)
		.all(sourceTemplateId, activeTimezone) as Record<string, unknown>[]

	for (const raw of rows) {
		const row = rowFromDb(raw)
		if (row.status === 'in_progress') {
			const reconciled = reconcileDailyGenerationReservation(row, now)
			if (reconciled.status === 'in_progress') {
				// Force-cancel so the old zone cannot complete afterward.
				updateDailyGenerationRow(
					reconciled.sourceTemplateId,
					reconciled.generatedDate,
					reconciled.generatingTimezone,
					{
						status: 'failed',
						rundownId: null
					}
				)
			}
		} else if (row.status === 'failed') {
			// Still reconcile in case a clone landed under this key.
			reconcileDailyGenerationReservation(row, now)
		}
	}
}

async function waitForExistingAttempt(
	sourceTemplateId: string,
	generatedDate: string,
	generatingTimezone: string,
	logger: GenerationLogger
): Promise<DailyGenerationResult | null> {
	const deadline = Date.now() + JOIN_MAX_WAIT_MS
	while (Date.now() < deadline) {
		const row = readDailyGenerationRow(sourceTemplateId, generatedDate, generatingTimezone)
		if (!row) return null

		const reconciled = reconcileDailyGenerationReservation(row, new Date())
		if (reconciled.status === 'completed' && reconciled.rundownId) {
			const { result: rundown } = await rundownMutations.readOne(reconciled.rundownId)
			logger.info('Joined completed daily generation', {
				attemptId: reconciled.attemptId,
				idempotencyKey: reconciled.idempotencyKey,
				rundownId: reconciled.rundownId,
				generatedDate,
				sourceTemplateId
			})
			return {
				generatedDate,
				timezone: generatingTimezone,
				status: 'completed',
				rundownId: reconciled.rundownId,
				rundown,
				attemptId: reconciled.attemptId,
				idempotencyKey: reconciled.idempotencyKey,
				created: false
			}
		}

		if (reconciled.status === 'failed') {
			return null
		}

		if (new Date(reconciled.leaseExpiresAt).getTime() <= Date.now()) {
			reconcileDailyGenerationReservation(reconciled, new Date())
			return null
		}

		await sleep(JOIN_POLL_MS)
	}

	return null
}

function insertInProgressReservation(params: {
	sourceTemplateId: string
	generatedDate: string
	generatingTimezone: string
	attemptId: string
	idempotencyKey: string
	leaseExpiresAt: string
}): { inserted: boolean; existing?: DailyGenerationRow } {
	try {
		db.prepare(
			`
			INSERT INTO dailyGenerations (
				sourceTemplateId,
				generatedDate,
				generatingTimezone,
				attemptId,
				idempotencyKey,
				leaseExpiresAt,
				rundownId,
				status
			) VALUES (?, ?, ?, ?, ?, ?, NULL, 'in_progress')
		`
		).run(
			params.sourceTemplateId,
			params.generatedDate,
			params.generatingTimezone,
			params.attemptId,
			params.idempotencyKey,
			params.leaseExpiresAt
		)
		return { inserted: true }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		if (!/UNIQUE constraint failed/i.test(message)) {
			throw error
		}
		const existing = readDailyGenerationRow(
			params.sourceTemplateId,
			params.generatedDate,
			params.generatingTimezone
		)
		return { inserted: false, existing }
	}
}

async function runCloneAttempt(params: {
	templateId: string
	generatedDate: string
	generatingTimezone: string
	attemptId: string
	idempotencyKey: string
	logger: GenerationLogger
}): Promise<DailyGenerationResult> {
	const { templateId, generatedDate, generatingTimezone, attemptId, idempotencyKey, logger } =
		params

	logger.info('Starting daily rundown clone', {
		attemptId,
		idempotencyKey,
		generatedDate,
		sourceTemplateId: templateId,
		generatingTimezone
	})

	const leaseRenewalMs = Math.min(DAILY_GENERATION_LEASE_MS / 3, 60_000)
	const leaseInterval = setInterval(() => {
		try {
			updateDailyGenerationRow(templateId, generatedDate, generatingTimezone, {
				status: 'in_progress',
				leaseExpiresAt: new Date(Date.now() + DAILY_GENERATION_LEASE_MS).toISOString()
			})
		} catch (renewError) {
			logger.error('Failed to renew daily generation lease', {
				attemptId,
				idempotencyKey,
				generatedDate,
				sourceTemplateId: templateId,
				error: renewError instanceof Error ? renewError.message : String(renewError)
			})
		}
	}, leaseRenewalMs)

	try {
		const { result, error } = await rundownMutations.createRundownCopy({
			id: templateId,
			preserveTemplate: false,
			attemptId,
			idempotencyKey
		})

		if (error || !result?.rundown) {
			throw error instanceof Error
				? error
				: new Error(error ? String(error) : 'createRundownCopy returned no rundown')
		}

		const rundownId = result.rundown.id
		// Ensure stamps landed (createRundownCopy should write them; belt-and-suspenders update).
		if (result.rundown.idempotencyKey !== idempotencyKey || result.rundown.attemptId !== attemptId) {
			const { error: stampError } = await rundownMutations.update({
				...result.rundown,
				attemptId,
				idempotencyKey
			})
			if (stampError) {
				throw stampError
			}
		}

		const completed = updateDailyGenerationRow(templateId, generatedDate, generatingTimezone, {
			status: 'completed',
			rundownId
		})

		logger.info('Daily rundown clone completed', {
			attemptId,
			idempotencyKey,
			rundownId,
			generatedDate,
			sourceTemplateId: templateId
		})

		return {
			generatedDate,
			timezone: generatingTimezone,
			status: completed.status,
			rundownId,
			rundown: result.rundown,
			attemptId,
			idempotencyKey,
			created: true
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const stack = error instanceof Error ? error.stack : undefined

		// Must reconcile before failing — clone may have committed.
		const current = readDailyGenerationRow(templateId, generatedDate, generatingTimezone)
		if (current) {
			const reconciled = reconcileDailyGenerationReservation(current, new Date())
			if (reconciled.status === 'completed' && reconciled.rundownId) {
				logger.info('Reconciled daily clone after error to completed', {
					attemptId: reconciled.attemptId,
					idempotencyKey: reconciled.idempotencyKey,
					rundownId: reconciled.rundownId,
					generatedDate,
					sourceTemplateId: templateId
				})
				const { result: rundown } = await rundownMutations.readOne(reconciled.rundownId)
				return {
					generatedDate,
					timezone: generatingTimezone,
					status: 'completed',
					rundownId: reconciled.rundownId,
					rundown,
					attemptId: reconciled.attemptId,
					idempotencyKey: reconciled.idempotencyKey,
					created: false
				}
			}

			if (
				reconciled.status === 'in_progress' &&
				new Date(reconciled.leaseExpiresAt).getTime() > Date.now()
			) {
				// Unknown outcome with live lease — do not fail yet.
				logger.error('Daily clone outcome unknown; leaving in_progress until lease expires', {
					attemptId,
					idempotencyKey,
					generatedDate,
					sourceTemplateId: templateId,
					error: message,
					stack
				})
				return {
					generatedDate,
					timezone: generatingTimezone,
					status: 'in_progress',
					rundownId: null,
					attemptId,
					idempotencyKey,
					created: false
				}
			}

			if (reconciled.status === 'in_progress') {
				updateDailyGenerationRow(templateId, generatedDate, generatingTimezone, {
					status: 'failed',
					rundownId: null
				})
			}
		}

		logger.error('Daily rundown clone failed', {
			attemptId,
			idempotencyKey,
			generatedDate,
			sourceTemplateId: templateId,
			error: message,
			stack
		})

		throw error instanceof Error ? error : new Error(message)
	} finally {
		clearInterval(leaseInterval)
	}
}

export async function assertTemplateRundown(templateId: string): Promise<Rundown> {
	const { result, error } = await rundownMutations.readOne(templateId)
	if (error || !result) {
		throw new Error(`Daily template rundown not found: ${templateId}`)
	}
	if (!result.isTemplate) {
		throw new Error(`Rundown ${templateId} is not a template (isTemplate must be true)`)
	}
	return result
}

export type GenerateDailyOptions = {
	/** When true, ignore dailyCloneTime (manual Generate now). */
	force?: boolean
	now?: Date
	settings?: ApplicationSettings
	logger?: GenerationLogger
	/** Internal: bounds race-retry recursion. */
	_retryDepth?: number
}

/**
 * Single entry point for scheduled and manual daily template clones.
 * Uniqueness is enforced by the dailyGenerations primary key at insert time.
 */
export async function generateDailyRundownIfNeeded(
	templateId: string,
	options: GenerateDailyOptions = {}
): Promise<DailyGenerationResult | null> {
	const logger = options.logger ?? defaultLogger
	const now = options.now ?? new Date()

	const settings =
		options.settings ??
		(await settingsMutations.read()).result ??
		({} as ApplicationSettings)

	const timezone = settings.dailyCloneTimezone?.trim() || DEFAULT_DAILY_CLONE_TIMEZONE
	if (!isValidIanaTimeZone(timezone)) {
		throw new Error(`Invalid dailyCloneTimezone: ${timezone}`)
	}

	const cloneTime = settings.dailyCloneTime?.trim()
	if (!options.force) {
		if (!cloneTime) {
			return null
		}
		if (!DAILY_CLONE_TIME_RE.test(cloneTime)) {
			throw new Error(`Invalid dailyCloneTime: ${cloneTime}`)
		}
		if (!hasDailyCloneTimePassed(now, cloneTime, timezone)) {
			return null
		}
	}

	await assertTemplateRundown(templateId)

	reconcileForeignTimezoneInProgress(templateId, timezone, now)

	const generatedDate = getDailyGeneratedDate(now, timezone)

	const existing = readDailyGenerationRow(templateId, generatedDate, timezone)
	if (existing) {
		const reconciled = reconcileDailyGenerationReservation(existing, now)
		if (reconciled.status === 'completed' && reconciled.rundownId) {
			const { result: rundown } = await rundownMutations.readOne(reconciled.rundownId)
			return {
				generatedDate,
				timezone,
				status: 'completed',
				rundownId: reconciled.rundownId,
				rundown,
				attemptId: reconciled.attemptId,
				idempotencyKey: reconciled.idempotencyKey,
				created: false
			}
		}

		if (reconciled.status === 'in_progress') {
			if (new Date(reconciled.leaseExpiresAt).getTime() > now.getTime()) {
				const joined = await waitForExistingAttempt(
					templateId,
					generatedDate,
					timezone,
					logger
				)
				if (joined) return joined
				// Lease may have expired while waiting — fall through to retry path.
			} else {
				reconcileDailyGenerationReservation(reconciled, now)
			}
		}

		const afterWait = readDailyGenerationRow(templateId, generatedDate, timezone)
		if (afterWait?.status === 'completed' && afterWait.rundownId) {
			const { result: rundown } = await rundownMutations.readOne(afterWait.rundownId)
			return {
				generatedDate,
				timezone,
				status: 'completed',
				rundownId: afterWait.rundownId,
				rundown,
				attemptId: afterWait.attemptId,
				idempotencyKey: afterWait.idempotencyKey,
				created: false
			}
		}

		if (afterWait?.status === 'failed' || afterWait?.status === 'in_progress') {
			// Explicit failed → in_progress (or expired in_progress → failed → in_progress).
			const current =
				afterWait.status === 'in_progress'
					? reconcileDailyGenerationReservation(afterWait, now)
					: afterWait
			if (current.status === 'completed' && current.rundownId) {
				const { result: rundown } = await rundownMutations.readOne(current.rundownId)
				return {
					generatedDate,
					timezone,
					status: 'completed',
					rundownId: current.rundownId,
					rundown,
					attemptId: current.attemptId,
					idempotencyKey: current.idempotencyKey,
					created: false
				}
			}
			if (current.status === 'in_progress') {
				const joined = await waitForExistingAttempt(
					templateId,
					generatedDate,
					timezone,
					logger
				)
				if (joined) return joined
				throw new Error('Another daily generation attempt is still in progress')
			}

			const attemptId = randomUUID()
			const idempotencyKey = mintIdempotencyKey(templateId, generatedDate, timezone, attemptId)
			const leaseExpiresAt = new Date(now.getTime() + DAILY_GENERATION_LEASE_MS).toISOString()
			updateDailyGenerationRow(templateId, generatedDate, timezone, {
				status: 'in_progress',
				attemptId,
				idempotencyKey,
				leaseExpiresAt,
				rundownId: null
			})
			return runCloneAttempt({
				templateId,
				generatedDate,
				generatingTimezone: timezone,
				attemptId,
				idempotencyKey,
				logger
			})
		}
	}

	const attemptId = randomUUID()
	const idempotencyKey = mintIdempotencyKey(templateId, generatedDate, timezone, attemptId)
	const leaseExpiresAt = new Date(now.getTime() + DAILY_GENERATION_LEASE_MS).toISOString()

	const insert = insertInProgressReservation({
		sourceTemplateId: templateId,
		generatedDate,
		generatingTimezone: timezone,
		attemptId,
		idempotencyKey,
		leaseExpiresAt
	})

	if (!insert.inserted) {
		// Race: another caller inserted first.
		if (insert.existing?.status === 'completed' && insert.existing.rundownId) {
			const { result: rundown } = await rundownMutations.readOne(insert.existing.rundownId)
			return {
				generatedDate,
				timezone,
				status: 'completed',
				rundownId: insert.existing.rundownId,
				rundown,
				attemptId: insert.existing.attemptId,
				idempotencyKey: insert.existing.idempotencyKey,
				created: false
			}
		}
		if (insert.existing?.status === 'in_progress') {
			const joined = await waitForExistingAttempt(
				templateId,
				generatedDate,
				timezone,
				logger
			)
			if (joined) return joined
		}
		const retryDepth = (options._retryDepth ?? 0) + 1
		if (retryDepth >= 3) {
			throw new Error('Daily generation race retry limit exceeded')
		}
		// Recurse into the failed/retry path via re-read.
		return generateDailyRundownIfNeeded(templateId, {
			...options,
			now: new Date(),
			settings,
			_retryDepth: retryDepth
		})
	}

	return runCloneAttempt({
		templateId,
		generatedDate,
		generatingTimezone: timezone,
		attemptId,
		idempotencyKey,
		logger
	})
}

export async function getDailyGenerationStatusForTemplate(
	templateId: string,
	options: { now?: Date; settings?: ApplicationSettings } = {}
): Promise<DailyGenerationStatusResult> {
	const now = options.now ?? new Date()
	const settings =
		options.settings ??
		(await settingsMutations.read()).result ??
		({} as ApplicationSettings)
	const rawTimezone = settings.dailyCloneTimezone?.trim() || DEFAULT_DAILY_CLONE_TIMEZONE
	const timezone = isValidIanaTimeZone(rawTimezone) ? rawTimezone : DEFAULT_DAILY_CLONE_TIMEZONE
	const generatedDate = getDailyGeneratedDate(now, timezone)
	const row = readDailyGenerationRow(templateId, generatedDate, timezone)

	if (!row || row.status !== 'completed' || !row.rundownId) {
		return {
			generatedDate,
			timezone,
			status: row?.status ?? null,
			rundownId: null
		}
	}

	const { result: rundown } = await rundownMutations.readOne(row.rundownId)
	return {
		generatedDate,
		timezone,
		status: 'completed',
		rundownId: row.rundownId,
		rundownName: rundown?.name
	}
}

export async function generateConfiguredDailyRundownIfNeeded(
	options: GenerateDailyOptions = {}
): Promise<DailyGenerationResult | null> {
	const settings =
		options.settings ??
		(await settingsMutations.read()).result ??
		({} as ApplicationSettings)

	const templateId = settings.dailyTemplateRundownId?.trim()
	if (!templateId) {
		return null
	}
	if (!settings.dailyCloneTime?.trim() && !options.force) {
		return null
	}

	return generateDailyRundownIfNeeded(templateId, { ...options, settings })
}
