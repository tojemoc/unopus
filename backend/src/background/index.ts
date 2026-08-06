import { coreHandler } from './coreHandler'
import { initSocketServer } from '../socketServer'
import { startDailyTemplateScheduler } from './dailyTemplateScheduler'

export interface BasicPayload extends Record<string, unknown> {
	playerId: number
}

export class ControlAPI {
	async init(port: number = 3010): Promise<void> {
		initSocketServer(port)
		await coreHandler.init()
		startDailyTemplateScheduler()
	}
}
