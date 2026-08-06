import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'http'
import type { AddressInfo } from 'net'
// Initialize db before authStore/coreDiagnostics (tsx CJS circular-import safety).
import '../background/db.js'
import { createSession } from '../background/auth/authStore.js'
import { coreHandler } from '../background/coreHandler.js'
import { db } from '../background/db.js'
import { CoreConnectionStatus } from '../background/interfaces.js'
import {
	DIAGNOSTICS_PROBE_RUNDOWN_ID,
	PROBE_TTL_MS,
	getCoalescedContentStatusProbe,
	registerCoreDiagnosticsRoutes,
	resetCoreDiagnosticsProbeCacheForTests
} from './coreDiagnostics.js'

type CoreHandlerInternals = {
	_connectionInfo: {
		url?: string
		port?: number
		status: CoreConnectionStatus
	}
}

function setCoreStatus(status: CoreConnectionStatus): void {
	const internals = coreHandler as unknown as CoreHandlerInternals
	internals._connectionInfo = {
		url: '127.0.0.1',
		port: 3000,
		status
	}
}

function getAdminUserId(): string {
	const row = db.prepare(`SELECT id FROM users WHERE username = ?`).get('admin') as
		| { id: string }
		| undefined
	assert.ok(row?.id, 'expected seeded admin user for diagnostics route auth tests')
	return row.id
}

async function listen(app: express.Application): Promise<{
	baseUrl: string
	close: () => Promise<void>
}> {
	const server = http.createServer(app)
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	const { port } = server.address() as AddressInfo
	return {
		baseUrl: `http://127.0.0.1:${port}`,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()))
			})
	}
}

describe('/api/core/diagnostics', () => {
	const originalCallMethodRaw = coreHandler.core.callMethodRaw.bind(coreHandler.core)
	let realNow: () => number
	let fakeNow = 0

	beforeEach(() => {
		resetCoreDiagnosticsProbeCacheForTests()
		setCoreStatus(CoreConnectionStatus.DISCONNECTED)
		coreHandler.core.callMethodRaw = originalCallMethodRaw
		realNow = Date.now
		fakeNow = 1_700_000_000_000
		Date.now = () => fakeNow
	})

	afterEach(() => {
		resetCoreDiagnosticsProbeCacheForTests()
		setCoreStatus(CoreConnectionStatus.DISCONNECTED)
		coreHandler.core.callMethodRaw = originalCallMethodRaw
		Date.now = realNow
	})

	it('rejects unauthenticated requests', async () => {
		const app = express()
		registerCoreDiagnosticsRoutes(app)
		const { baseUrl, close } = await listen(app)

		try {
			const response = await fetch(`${baseUrl}/api/core/diagnostics`)
			assert.equal(response.status, 401)
			assert.deepEqual(await response.json(), { error: 'Not authenticated' })
		} finally {
			await close()
		}
	})

	it('returns red Core disconnected without calling content-status', async () => {
		let callCount = 0
		coreHandler.core.callMethodRaw = (async () => {
			callCount += 1
			return { rundownExternalId: DIAGNOSTICS_PROBE_RUNDOWN_ID, pieces: [] }
		}) as typeof coreHandler.core.callMethodRaw

		setCoreStatus(CoreConnectionStatus.DISCONNECTED)

		const app = express()
		registerCoreDiagnosticsRoutes(app)
		const { baseUrl, close } = await listen(app)
		const { sessionId } = createSession(getAdminUserId())

		try {
			const response = await fetch(`${baseUrl}/api/core/diagnostics`, {
				headers: { Cookie: `duopus_session=${encodeURIComponent(sessionId)}` }
			})
			assert.equal(response.status, 200)
			const body = (await response.json()) as {
				contentStatusProbe: { trafficLight: string; summary: string; ok: boolean }
				connection: { status: string }
			}
			assert.equal(body.connection.status, CoreConnectionStatus.DISCONNECTED)
			assert.equal(body.contentStatusProbe.ok, false)
			assert.equal(body.contentStatusProbe.trafficLight, 'red')
			assert.equal(body.contentStatusProbe.summary, 'Core disconnected')
			assert.equal(callCount, 0)
		} finally {
			await close()
		}
	})

	it('returns green when content-status succeeds using the diagnostics probe rundown id', async () => {
		const seenArgs: unknown[][] = []
		coreHandler.core.callMethodRaw = (async (method: string, args?: unknown[]) => {
			seenArgs.push([method, ...(args ?? [])])
			return { rundownExternalId: DIAGNOSTICS_PROBE_RUNDOWN_ID, pieces: [] }
		}) as typeof coreHandler.core.callMethodRaw

		setCoreStatus(CoreConnectionStatus.CONNECTED)

		const result = await getCoalescedContentStatusProbe()
		assert.equal(result.ok, true)
		assert.equal(result.trafficLight, 'green')
		assert.equal(result.summary, 'Core reachable, device configured')
		assert.equal(seenArgs.length, 1)
		assert.equal(seenArgs[0]?.[0], 'peripheralDevice.packageManager.getContentStatusForRundown')
		assert.equal(seenArgs[0]?.[1], DIAGNOSTICS_PROBE_RUNDOWN_ID)
		assert.equal(DIAGNOSTICS_PROBE_RUNDOWN_ID, '__diagnostics_probe__')
	})

	it('returns yellow with a safe operator label when content-status throws', async () => {
		coreHandler.core.callMethodRaw = (async () => {
			throw new Error('Device has no studioId assigned for device xyz-secret')
		}) as typeof coreHandler.core.callMethodRaw

		setCoreStatus(CoreConnectionStatus.CONNECTED)

		const app = express()
		registerCoreDiagnosticsRoutes(app)
		const { baseUrl, close } = await listen(app)
		const { sessionId } = createSession(getAdminUserId())

		try {
			const response = await fetch(`${baseUrl}/api/core/diagnostics`, {
				headers: { Cookie: `duopus_session=${encodeURIComponent(sessionId)}` }
			})
			assert.equal(response.status, 200)
			const body = (await response.json()) as {
				contentStatusProbe: {
					ok: boolean
					trafficLight: string
					operatorLabel?: string
					summary: string
				}
			}
			assert.equal(body.contentStatusProbe.ok, false)
			assert.equal(body.contentStatusProbe.trafficLight, 'yellow')
			assert.equal(body.contentStatusProbe.operatorLabel, 'Device has no studio')
			assert.match(body.contentStatusProbe.summary, /local scan only/)
			assert.equal(JSON.stringify(body).includes('xyz-secret'), false)
		} finally {
			await close()
		}
	})

	it('reuses cached probe results within the TTL window', async () => {
		let callCount = 0
		coreHandler.core.callMethodRaw = (async () => {
			callCount += 1
			return { rundownExternalId: DIAGNOSTICS_PROBE_RUNDOWN_ID, pieces: [] }
		}) as typeof coreHandler.core.callMethodRaw
		setCoreStatus(CoreConnectionStatus.CONNECTED)

		const first = await getCoalescedContentStatusProbe()
		fakeNow += PROBE_TTL_MS - 1
		const second = await getCoalescedContentStatusProbe()

		assert.equal(callCount, 1)
		assert.equal(first.checkedAt, second.checkedAt)
	})

	it('refreshes the probe after the TTL expires', async () => {
		let callCount = 0
		coreHandler.core.callMethodRaw = (async () => {
			callCount += 1
			return { rundownExternalId: DIAGNOSTICS_PROBE_RUNDOWN_ID, pieces: [] }
		}) as typeof coreHandler.core.callMethodRaw
		setCoreStatus(CoreConnectionStatus.CONNECTED)

		await getCoalescedContentStatusProbe()
		assert.equal(callCount, 1)

		fakeNow += PROBE_TTL_MS + 1
		await getCoalescedContentStatusProbe()

		assert.equal(callCount, 2)
	})

	it('coalesces concurrent in-flight probes into one Core call', async () => {
		let callCount = 0
		let release!: (value: { rundownExternalId: string; pieces: never[] }) => void
		const gate = new Promise<{ rundownExternalId: string; pieces: never[] }>((resolve) => {
			release = resolve
		})

		coreHandler.core.callMethodRaw = (async () => {
			callCount += 1
			return gate
		}) as typeof coreHandler.core.callMethodRaw
		setCoreStatus(CoreConnectionStatus.CONNECTED)

		const pending = [
			getCoalescedContentStatusProbe(),
			getCoalescedContentStatusProbe(),
			getCoalescedContentStatusProbe()
		]

		// Allow the starter task to register in-flight before releasing Core.
		await Promise.resolve()
		assert.equal(callCount, 1)

		release({ rundownExternalId: DIAGNOSTICS_PROBE_RUNDOWN_ID, pieces: [] })
		const results = await Promise.all(pending)

		assert.equal(callCount, 1)
		assert.equal(results[0]?.checkedAt, results[1]?.checkedAt)
		assert.equal(results[1]?.checkedAt, results[2]?.checkedAt)
		assert.equal(results[0]?.trafficLight, 'green')
	})
})
