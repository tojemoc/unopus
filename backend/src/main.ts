'use strict'

import { initializeDefaults as initializeSettingsDefaults } from './background/api/settings'
import { startRundownScheduler } from './background/rundownSchedule'
import { ControlAPI } from './background'

async function startRundownEditorServer() {
	const portNumber: number | undefined = process.env.PORT
		? parseInt(process.env.PORT, 10)
		: undefined

	await initializeSettingsDefaults()

	startRundownScheduler()

	const api = new ControlAPI()
	await api.init(portNumber).catch((error) => {
		console.error(error)
		process.exit(1)
	})
}

startRundownEditorServer()
