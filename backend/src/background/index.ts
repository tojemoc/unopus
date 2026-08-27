import { coreHandler } from './coreHandler'
import { initSocketServer } from '../socketServer'
import { startDailyTemplateScheduler } from './dailyTemplateScheduler'

export interface BasicPayload extends Record<string, unknown> {
	playerId: number
}

/**
 * Main control API for the rundown editor backend.
 * Initializes the socket server, core handler, and daily template scheduler.
 */
export class ControlAPI {
	/**
	 * Initializes the control API by starting the socket server, core handler, and daily template scheduler.
	 * @param port - The port number for the server. Defaults to 3010.
	 */
	async init(port: number = 3010): Promise<void> {
		initSocketServer(port)
		await coreHandler.init()
		startDailyTemplateScheduler()
	}
}
