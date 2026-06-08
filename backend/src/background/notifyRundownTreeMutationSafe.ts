import { notifyRundownTreeMutation } from './rundownSchedule'

export async function notifyRundownTreeMutationSafe(rundownId: string): Promise<void> {
	try {
		await notifyRundownTreeMutation(rundownId)
	} catch (err) {
		console.error('notifyRundownTreeMutation failed', { rundownId, err })
	}
}
