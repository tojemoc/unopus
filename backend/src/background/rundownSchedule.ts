import type {
	ApplicationSettings,
	RegenerateFromTemplateResult,
	Rundown
} from './interfaces'
import { mutations as rundownMutations } from './api/rundowns'
import { mutations as settingsMutations } from './api/settings'
import { generateRundownFromTemplate } from './storyComposer'
import { getSocketIO } from './socket'
import {
	compareDateKeys,
	getSchedulingDateKeys,
	getTodayDateKey,
	parseTimeHHmm,
	scheduledStartMs
} from './timezoneUtil'

let lastDateKeyInZone: string | undefined
let midnightTimer: ReturnType<typeof setTimeout> | undefined

export async function getApplicationSettings(): Promise<ApplicationSettings> {
	const { result } = await settingsMutations.read()
	return {
		timezone: 'Europe/Bratislava',
		scheduleAheadCount: 5,
		scheduleStartTime: '18:00',
		rundownListPastVisible: 2,
		rundownListFutureVisible: 4,
		...result
	}
}

export function getEffectiveScheduleForTemplate(
	settings: ApplicationSettings,
	template: Rundown
): { enabled: boolean; aheadCount: number; startTime: string } {
	return {
		enabled: template.scheduleEnabled === true,
		aheadCount: template.scheduleAheadCount ?? settings.scheduleAheadCount ?? 5,
		startTime: template.scheduleStartTime ?? settings.scheduleStartTime ?? '18:00'
	}
}

export async function listAllRundowns(): Promise<Rundown[]> {
	const { result } = await rundownMutations.read({})
	return Array.isArray(result) ? result : result ? [result] : []
}

export function listGeneratedFromTemplate(
	rundowns: Rundown[],
	templateId: string
): Rundown[] {
	return rundowns.filter(
		(r) => !r.isTemplate && r.sourceTemplateId === templateId && r.scheduleDateKey
	)
}

export async function bumpTemplateRevision(templateId: string): Promise<number> {
	const { result: template } = await rundownMutations.readOne(templateId)
	if (!template?.isTemplate) {
		return 0
	}
	const nextRevision = (template.templateRevision ?? 0) + 1
	await rundownMutations.update({
		...template,
		templateRevision: nextRevision
	})
	await markGeneratedRundownsOutdated(templateId)
	return nextRevision
}

export async function markGeneratedRundownsOutdated(templateId: string): Promise<void> {
	const rundowns = await listAllRundowns()
	const io = getSocketIO()
	const updated: Rundown[] = []

	for (const rundown of listGeneratedFromTemplate(rundowns, templateId)) {
		const { result } = await rundownMutations.update({
			...rundown,
			templateOutdated: true
		})
		if (result) {
			updated.push(result)
		}
	}

	if (updated.length > 0) {
		io?.emit('rundowns:update', { rundowns: updated })
	}
}

export async function notifyRundownTreeMutation(rundownId: string): Promise<void> {
	const { result: rundown } = await rundownMutations.readOne(rundownId)
	if (!rundown) {
		return
	}
	if (rundown.isTemplate) {
		await bumpTemplateRevision(rundownId)
		return
	}
	if (rundown.sourceTemplateId) {
		await markGeneratedRundownModified(rundownId)
	}
}

export async function markGeneratedRundownModified(rundownId: string): Promise<void> {
	const { result: rundown } = await rundownMutations.readOne(rundownId)
	if (!rundown?.sourceTemplateId || rundown.isTemplate) {
		return
	}
	if (rundown.modifiedAfterGeneration) {
		return
	}
	const { result } = await rundownMutations.update({
		...rundown,
		modifiedAfterGeneration: true
	})
	if (result) {
		getSocketIO()?.emit('rundowns:update', { rundowns: [result] })
	}
}

export async function reconcileTemplateSchedule(
	templateId: string,
	now = Date.now()
): Promise<Rundown[]> {
	const settings = await getApplicationSettings()
	const { result: template } = await rundownMutations.readOne(templateId)
	if (!template?.isTemplate) {
		return []
	}

	const schedule = getEffectiveScheduleForTemplate(settings, template)
	if (!schedule.enabled) {
		return []
	}

	const timeZone = settings.timezone ?? 'Europe/Bratislava'
	const dateKeys = getSchedulingDateKeys(timeZone, schedule.aheadCount, now)
	const allRundowns = await listAllRundowns()
	const existing = listGeneratedFromTemplate(allRundowns, templateId)
	const existingByKey = new Map(
		existing.map((r) => [r.scheduleDateKey as string, r])
	)
	const created: Rundown[] = []
	const revision = template.templateRevision ?? 0

	for (const dateKey of dateKeys) {
		if (existingByKey.has(dateKey)) {
			continue
		}
		const startMs = scheduledStartMs(timeZone, dateKey, schedule.startTime)
		const { result, error } = await generateRundownFromTemplate({
			templateRundownId: templateId,
			scheduledDate: startMs,
			scheduleDateKey: dateKey,
			sourceTemplateRevision: revision
		})
		if (!result?.rundown) {
			console.error('reconcileTemplateSchedule:', templateId, dateKey, error)
			continue
		}
		if (error) {
			console.error(
				'reconcileTemplateSchedule: rundown created but not synced to Core',
				templateId,
				dateKey,
				error
			)
		}
		created.push(result.rundown)
	}

	if (created.length > 0) {
		getSocketIO()?.emit('rundowns:update', { rundowns: created })
	}

	return created
}

export async function reconcileAllEnabledTemplates(now = Date.now()): Promise<void> {
	const settings = await getApplicationSettings()
	const rundowns = await listAllRundowns()
	const templates = rundowns.filter((r) => r.isTemplate)

	for (const template of templates) {
		const schedule = getEffectiveScheduleForTemplate(settings, template)
		if (!schedule.enabled) {
			continue
		}
		await reconcileTemplateSchedule(template.id, now)
	}
}

export async function regenerateFromTemplate(
	templateId: string
): Promise<{ result?: RegenerateFromTemplateResult; error?: Error }> {
	const settings = await getApplicationSettings()
	const timeZone = settings.timezone ?? 'Europe/Bratislava'
	const todayKey = getTodayDateKey(timeZone)

	const { result: template } = await rundownMutations.readOne(templateId)
	if (!template?.isTemplate) {
		return { error: new Error('Rundown is not a template') }
	}

	const schedule = getEffectiveScheduleForTemplate(settings, template)
	const startTime = schedule.startTime
	const revision = template.templateRevision ?? 0
	const allRundowns = await listAllRundowns()
	const generated = listGeneratedFromTemplate(allRundowns, templateId)

	const summary: RegenerateFromTemplateResult = {
		created: 0,
		updated: 0,
		skippedModified: 0,
		skippedPast: 0
	}

	const dateKeys = getSchedulingDateKeys(
		timeZone,
		schedule.aheadCount,
		Date.now()
	).filter((key) => compareDateKeys(key, todayKey) >= 0)

	const io = getSocketIO()
	const updatedRundowns: Rundown[] = []

	for (const dateKey of dateKeys) {
		const existing = generated.find((r) => r.scheduleDateKey === dateKey)
		if (existing && compareDateKeys(dateKey, todayKey) < 0) {
			summary.skippedPast++
			continue
		}
		if (existing?.modifiedAfterGeneration) {
			summary.skippedModified++
			continue
		}

		if (existing) {
			await rundownMutations.delete({ id: existing.id })
		}

		const startMs = scheduledStartMs(timeZone, dateKey, startTime)
		const { result, error } = await generateRundownFromTemplate({
			templateRundownId: templateId,
			scheduledDate: startMs,
			scheduleDateKey: dateKey,
			sourceTemplateRevision: revision
		})
		if (!result?.rundown) {
			return { error: error ?? new Error('Failed to regenerate rundown') }
		}
		if (error) {
			console.error(
				'regenerateFromTemplate: rundown created but not synced to Core',
				templateId,
				dateKey,
				error
			)
		}
		updatedRundowns.push(result.rundown)
		if (existing) {
			summary.updated++
		} else {
			summary.created++
		}
	}

	if (updatedRundowns.length > 0) {
		io?.emit('rundowns:update', { rundowns: updatedRundowns })
	}

	return { result: summary }
}

function scheduleNextMidnightCheck(timeZone: string): void {
	if (midnightTimer) {
		clearTimeout(midnightTimer)
	}
	midnightTimer = setTimeout(
		() => {
			void onMidnightTick(timeZone)
		},
		60 * 1000
	)
}

async function onMidnightTick(timeZone: string): Promise<void> {
	const todayKey = getTodayDateKey(timeZone)
	if (lastDateKeyInZone !== todayKey) {
		lastDateKeyInZone = todayKey
		await reconcileAllEnabledTemplates()
	}
	scheduleNextMidnightCheck(timeZone)
}

export function startRundownScheduler(): void {
	void (async () => {
		const settings = await getApplicationSettings()
		const timeZone = settings.timezone ?? 'Europe/Bratislava'
		lastDateKeyInZone = getTodayDateKey(timeZone)
		await reconcileAllEnabledTemplates()
		scheduleNextMidnightCheck(timeZone)
	})()
}

export async function onApplicationSettingsUpdated(settings: ApplicationSettings): Promise<void> {
	const timeZone = settings.timezone ?? 'Europe/Bratislava'
	lastDateKeyInZone = getTodayDateKey(timeZone)
	await reconcileAllEnabledTemplates()
}
