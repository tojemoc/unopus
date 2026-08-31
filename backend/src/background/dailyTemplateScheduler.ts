import {
	DEFAULT_DAILY_CLONE_TIMEZONE,
	generateConfiguredDailyRundownIfNeeded,
	getDailyGeneratedDate,
	reconcileForeignTimezoneInProgress
} from './api/dailyGeneration'
import type { ApplicationSettings } from './interfaces'
import { mutations as settingsMutations } from './api/settings'

const TICK_MS = 60_000

let intervalHandle: ReturnType<typeof setInterval> | undefined
let tickInFlight = false

/**
 * Starts the daily template scheduler that periodically checks and generates daily rundowns from templates.
 * The scheduler runs approximately every minute.
 */
export function startDailyTemplateScheduler(): void {
	if (intervalHandle) {
		return
	}

	const tick = async () => {
		if (tickInFlight) {
			return
		}
		tickInFlight = true

		let settings: ApplicationSettings | undefined
		try {
			const { result } = await settingsMutations.read()
			settings = result
			const templateId = settings?.dailyTemplateRundownId?.trim()
			const timezone = settings?.dailyCloneTimezone?.trim() || DEFAULT_DAILY_CLONE_TIMEZONE

			if (templateId) {
				// Scheduler start / ongoing: cancel orphaned in_progress from a previous zone.
				reconcileForeignTimezoneInProgress(templateId, timezone)
			}

			const generation = await generateConfiguredDailyRundownIfNeeded({ settings })
			if (generation?.created && generation.rundownId) {
				console.info('Daily template scheduler generated rundown', {
					dailyTemplateRundownId: templateId,
					generatedDate: generation.generatedDate,
					rundownId: generation.rundownId,
					attemptId: generation.attemptId,
					idempotencyKey: generation.idempotencyKey
				})
			}
		} catch (error) {
			if (!settings) {
				const fallback = await settingsMutations.read().catch(() => ({
					result: undefined as ApplicationSettings | undefined
				}))
				settings = fallback.result
			}
			const timezone = settings?.dailyCloneTimezone?.trim() || DEFAULT_DAILY_CLONE_TIMEZONE
			const generatedDate = getDailyGeneratedDate(new Date(), timezone)
			console.error('Daily template scheduler tick failed', {
				dailyTemplateRundownId: settings?.dailyTemplateRundownId,
				generatedDate,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			})
		} finally {
			tickInFlight = false
		}
	}

	void tick()
	intervalHandle = setInterval(() => {
		void tick()
	}, TICK_MS)

	console.info('Daily template scheduler started (interval ~1 minute)')
}

/**
 * Stops the daily template scheduler by clearing the interval timer.
 */
export function stopDailyTemplateScheduler(): void {
	if (intervalHandle) {
		clearInterval(intervalHandle)
		intervalHandle = undefined
	}
}
