import {
	DEFAULT_DAILY_CLONE_TIMEZONE,
	generateConfiguredDailyRundownIfNeeded,
	getDailyGeneratedDate,
	reconcileForeignTimezoneInProgress
} from './api/dailyGeneration'
import { mutations as settingsMutations } from './api/settings'

const TICK_MS = 60_000

let intervalHandle: ReturnType<typeof setInterval> | undefined

export function startDailyTemplateScheduler(): void {
	if (intervalHandle) {
		return
	}

	const tick = async () => {
		try {
			const { result: settings } = await settingsMutations.read()
			const templateId = settings?.dailyTemplateRundownId?.trim()
			const timezone = settings?.dailyCloneTimezone?.trim() || DEFAULT_DAILY_CLONE_TIMEZONE

			if (templateId) {
				// Scheduler start / ongoing: cancel orphaned in_progress from a previous zone.
				reconcileForeignTimezoneInProgress(templateId, timezone)
			}

			const result = await generateConfiguredDailyRundownIfNeeded({ settings })
			if (result?.created && result.rundownId) {
				console.info('Daily template scheduler generated rundown', {
					dailyTemplateRundownId: templateId,
					generatedDate: result.generatedDate,
					rundownId: result.rundownId,
					attemptId: result.attemptId,
					idempotencyKey: result.idempotencyKey
				})
			}
		} catch (error) {
			const { result: settings } = await settingsMutations.read().catch(() => ({
				result: undefined
			}))
			const timezone = settings?.dailyCloneTimezone?.trim() || DEFAULT_DAILY_CLONE_TIMEZONE
			const generatedDate = getDailyGeneratedDate(new Date(), timezone)
			console.error('Daily template scheduler tick failed', {
				dailyTemplateRundownId: settings?.dailyTemplateRundownId,
				generatedDate,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			})
		}
	}

	void tick()
	intervalHandle = setInterval(() => {
		void tick()
	}, TICK_MS)

	console.info('Daily template scheduler started (interval ~1 minute)')
}

export function stopDailyTemplateScheduler(): void {
	if (intervalHandle) {
		clearInterval(intervalHandle)
		intervalHandle = undefined
	}
}
