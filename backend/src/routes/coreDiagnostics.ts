import type { Application, Request, Response } from 'express'
// Import db before authStore so tsx/CJS circular init assigns the DatabaseSync binding first.
import '../background/db'
import { getUserFromSession, parseSessionCookie } from '../background/auth/authStore'
import {
	CORE_CONTENT_STATUS_METHOD,
	type CoreRundownContentStatus
} from '../background/coreContentStatus'
import { coreHandler } from '../background/coreHandler'
import { toSafeCoreOperatorLabel } from '../background/coreOperatorLabels'
import { CoreConnectionStatus } from '../background/interfaces'

/** Deliberately nonexistent rundown — probe only proves method reachability + device studio attach. */
export const DIAGNOSTICS_PROBE_RUNDOWN_ID = '__diagnostics_probe__'

/** Match UI readiness poll cadence so concurrent browsers share one Core round-trip. */
export const PROBE_TTL_MS = 8_000

export type CoreDiagnosticsTrafficLight = 'green' | 'yellow' | 'red'

export interface CoreContentStatusProbeResult {
	/**
	 * Non-throwing call only proves: device credentials valid, device attached to a studio,
	 * and Core's rundown-content-status API responded. It does **not** prove Package Manager
	 * is connected or reporting fresh statuses.
	 */
	ok: boolean
	/** Safe operator-facing failure class when ok is false. */
	operatorLabel?: string
	trafficLight: CoreDiagnosticsTrafficLight
	/** Short label for what this probe actually proves. */
	summary: string
	checkedAt: string
}

export interface CoreDiagnosticsResponse {
	connection: {
		url?: string
		port?: number
		status: CoreConnectionStatus
	}
	deviceAuth: {
		deviceIdConfigured: boolean
		usingUnsecureToken: boolean
	}
	contentStatusProbe: CoreContentStatusProbeResult
}

type CachedProbe = {
	expiresAt: number
	result: CoreContentStatusProbeResult
}

let probeCache: CachedProbe | null = null
let probeInFlight: Promise<CoreContentStatusProbeResult> | null = null

/**
 * Retrieves the session user from the request's cookie.
 * @param req - The Express request object.
 * @returns The user object if found, undefined otherwise.
 */
function getSessionUser(req: Request) {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

/**
 * Runs a Core content status probe to verify Core connectivity and configuration.
 * @returns The probe result with status information.
 */
async function runContentStatusProbe(): Promise<CoreContentStatusProbeResult> {
	const checkedAt = new Date().toISOString()

	if (coreHandler.connectionInfo.status !== CoreConnectionStatus.CONNECTED) {
		return {
			ok: false,
			trafficLight: 'red',
			summary: 'Core disconnected',
			checkedAt
		}
	}

	try {
		// Successful response (even empty pieces) proves credentials + studio + method endpoint.
		await coreHandler.core.callMethodRaw(CORE_CONTENT_STATUS_METHOD, [
			DIAGNOSTICS_PROBE_RUNDOWN_ID
		]) as CoreRundownContentStatus

		return {
			ok: true,
			trafficLight: 'green',
			summary: 'Core reachable, device configured',
			checkedAt
		}
	} catch (error) {
		const rawMessage = error instanceof Error ? error.message : String(error)
		const stack = error instanceof Error ? error.stack : undefined
		console.warn('Core diagnostics content-status probe failed:', rawMessage, stack ?? '')

		const operatorLabel = toSafeCoreOperatorLabel(error)
		return {
			ok: false,
			operatorLabel,
			trafficLight: 'yellow',
			summary: `Core reachable, content-status call failed — showing local scan only (${operatorLabel})`,
			checkedAt
		}
	}
}

/**
 * Coalesce concurrent polls: within TTL, all callers share one probe result / checkedAt.
 * On expiry, one in-flight refresh; others await that promise (no stampede).
 */
export async function getCoalescedContentStatusProbe(): Promise<CoreContentStatusProbeResult> {
	const now = Date.now()
	if (probeCache && probeCache.expiresAt > now) {
		return probeCache.result
	}

	if (probeInFlight) {
		return probeInFlight
	}

	probeInFlight = (async () => {
		const result = await runContentStatusProbe()
		probeCache = {
			expiresAt: Date.now() + PROBE_TTL_MS,
			result
		}
		return result
	})()

	try {
		return await probeInFlight
	} finally {
		probeInFlight = null
	}
}

/** Test helper — clears the in-process probe cache. */
export function resetCoreDiagnosticsProbeCacheForTests(): void {
	probeCache = null
	probeInFlight = null
}

/**
 * Registers the Core diagnostics API routes on the Express application.
 * Provides endpoints to check Core connection status and device configuration.
 * @param app - The Express application instance.
 */
export function registerCoreDiagnosticsRoutes(app: Application): void {
	app.get('/api/core/diagnostics', async (req: Request, res: Response) => {
		if (!getSessionUser(req)) {
			res.status(401).json({ error: 'Not authenticated' })
			return
		}

		try {
			const contentStatusProbe = await getCoalescedContentStatusProbe()
			const response: CoreDiagnosticsResponse = {
				connection: {
					url: coreHandler.connectionInfo.url,
					port: coreHandler.connectionInfo.port,
					status: coreHandler.connectionInfo.status
				},
				deviceAuth: {
					deviceIdConfigured: coreHandler.deviceAuthInfo.deviceIdConfigured,
					usingUnsecureToken: coreHandler.deviceAuthInfo.usingUnsecureToken
				},
				contentStatusProbe
			}
			res.json(response)
		} catch (error) {
			console.error(error)
			res.status(400).json({ error: (error as Error).message })
		}
	})
}
