import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import type { CoreOptions } from '@sofie-automation/server-core-integration'
import { DEVICE_CONFIG_MANIFEST } from './configManifest.js'
import {
	isSimulateSofieCoreEnabled,
	SimulatedCoreConnection
} from './sofieCoreSimulation.js'

function makeOptions(): CoreOptions {
	return {
		deviceId: protectString('SimDevice'),
		deviceToken: 'unsecureToken',
		deviceCategory: PeripheralDeviceCategory.INGEST,
		deviceType: PeripheralDeviceType.SPREADSHEET,
		deviceName: 'test-sim',
		documentationUrl: 'https://example.test',
		versions: {},
		configManifest: DEVICE_CONFIG_MANIFEST
	}
}

describe('isSimulateSofieCoreEnabled', () => {
	it('is false when unset', () => {
		assert.equal(isSimulateSofieCoreEnabled({}), false)
	})

	it('accepts common truthy strings', () => {
		assert.equal(isSimulateSofieCoreEnabled({ SIMULATE_SOFIE_CORE: 'true' }), true)
		assert.equal(isSimulateSofieCoreEnabled({ SIMULATE_SOFIE_CORE: '1' }), true)
		assert.equal(isSimulateSofieCoreEnabled({ SIMULATE_SOFIE_CORE: 'YES' }), true)
		assert.equal(isSimulateSofieCoreEnabled({ SIMULATE_SOFIE_CORE: 'on' }), true)
	})

	it('rejects falsey strings', () => {
		assert.equal(isSimulateSofieCoreEnabled({ SIMULATE_SOFIE_CORE: 'false' }), false)
		assert.equal(isSimulateSofieCoreEnabled({ SIMULATE_SOFIE_CORE: '0' }), false)
		assert.equal(isSimulateSofieCoreEnabled({ SIMULATE_SOFIE_CORE: '' }), false)
	})
})

describe('SimulatedCoreConnection', () => {
	it('connects, accepts rundown sync, and answers content-status', async () => {
		const core = new SimulatedCoreConnection(makeOptions())
		let connected = false
		core.onConnected(() => {
			connected = true
		})

		await core.init({ host: '127.0.0.1', port: 3000 })
		await new Promise<void>((resolve) => {
			queueMicrotask(resolve)
		})
		assert.equal(connected, true)
		assert.equal(core.connected, true)

		await core.coreMethods.dataRundownCreate({
			externalId: 'rd-1',
			name: 'Demo',
			type: 'sofie-rundown-editor',
			segments: [],
			payload: {}
		} as never)
		assert.deepEqual(core.getSyncedRundownIds(), ['rd-1'])

		const status = (await core.callMethodRaw(
			'peripheralDevice.packageManager.getContentStatusForRundown',
			['rd-1']
		)) as { rundownExternalId: string; pieces: unknown[] }
		assert.equal(status.rundownExternalId, 'rd-1')
		assert.deepEqual(status.pieces, [])

		await core.setStatus({ statusCode: StatusCode.GOOD, messages: [] })
		await core.coreMethods.dataRundownDelete('rd-1')
		assert.deepEqual(core.getSyncedRundownIds(), [])

		const events = core.getRecentSyncEvents()
		assert.ok(events.some((e) => e.method === PeripheralDeviceAPIMethods.dataRundownCreate))
		assert.ok(events.some((e) => e.method === PeripheralDeviceAPIMethods.dataRundownDelete))

		await core.destroy()
		assert.equal(core.connected, false)
	})
})
