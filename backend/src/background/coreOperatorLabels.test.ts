import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toSafeCoreOperatorLabel } from './coreOperatorLabels.js'

describe('toSafeCoreOperatorLabel', () => {
	it('maps studio-assignment failures to a safe label', () => {
		assert.equal(
			toSafeCoreOperatorLabel(new Error('Device has no studioId assigned')),
			'Device has no studio'
		)
	})

	it('maps unauthorized failures', () => {
		assert.equal(toSafeCoreOperatorLabel(new Error('Unauthorized')), 'Unauthorized')
	})

	it('maps missing-method failures', () => {
		assert.equal(
			toSafeCoreOperatorLabel(new Error('Method not found: peripheralDevice.packageManager.getContentStatusForRundown')),
			'Core method unavailable'
		)
	})

	it('never echoes raw Core exception text for unknown errors', () => {
		const label = toSafeCoreOperatorLabel(
			new Error('Internal path /var/lib/sofie/device-xyz failed')
		)
		assert.equal(label, 'Core content-status call failed')
		assert.equal(label.includes('/var/lib'), false)
		assert.equal(label.includes('device-xyz'), false)
	})
})
