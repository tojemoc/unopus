import { EventEmitter } from 'events'
import {
	makeMethods,
	PeripheralDeviceAPIMethods,
	protectString,
	type Observer,
	type CoreOptions,
	type DDPConnectorOptions,
	type ExternalPeripheralDeviceAPI
} from '@sofie-automation/server-core-integration'
import type { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'

/** Keep in sync with `coreContentStatus.ts` — local copy avoids a circular import. */
const CORE_CONTENT_STATUS_METHOD = 'peripheralDevice.packageManager.getContentStatusForRundown'
/** Keep in sync with `corePlayoutState.ts` — local copy avoids a circular import. */
const CORE_PLAYOUT_STATE_METHOD = 'peripheralDevice.ingest.getRundownPlayoutState'

const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

/**
 * When true, the backend skips real DDP to Sofie Core and uses an in-process
 * simulator that accepts ingest sync pushes and answers content-status probes.
 */
export function isSimulateSofieCoreEnabled(
	env: NodeJS.ProcessEnv = process.env
): boolean {
	const raw = env.SIMULATE_SOFIE_CORE
	if (!raw) return false
	return TRUTHY.has(raw.trim().toLowerCase())
}

export type SimulatedSyncEvent = {
	method: string
	at: string
	args: unknown[]
}

type SimulatedCollectionDoc = { _id: string | PeripheralDeviceId; [key: string]: unknown }

/**
 * Minimal in-process stand-in for `@sofie-automation/server-core-integration`'s
 * CoreConnection. Enough for rundown sync, diagnostics, and readiness probes.
 */
export class SimulatedCoreConnection extends EventEmitter {
	private _destroyed = false
	private _connected = false
	private readonly _coreOptions: CoreOptions
	private readonly _peripheralDeviceApi: ExternalPeripheralDeviceAPI
	private readonly _syncedRundowns = new Map<string, unknown>()
	private readonly _recentSyncEvents: SimulatedSyncEvent[] = []
	private static readonly MAX_SYNC_EVENTS = 50

	constructor(coreOptions: CoreOptions) {
		super()
		this._coreOptions = coreOptions
		this._peripheralDeviceApi = makeMethods(
			this,
			PeripheralDeviceAPIMethods
		) as ExternalPeripheralDeviceAPI
	}

	get connected(): boolean {
		return this._connected && !this._destroyed
	}

	get deviceId(): PeripheralDeviceId {
		return this._coreOptions.deviceId
	}

	get coreMethods(): ExternalPeripheralDeviceAPI {
		return this._peripheralDeviceApi
	}

	get coreMethodsLowPriority(): ExternalPeripheralDeviceAPI {
		return this._peripheralDeviceApi
	}

	/** Test / diagnostics helper — recent accepted ingest method calls. */
	getRecentSyncEvents(): readonly SimulatedSyncEvent[] {
		return this._recentSyncEvents
	}

	/** Test helper — external ids currently held after create/update. */
	getSyncedRundownIds(): string[] {
		return [...this._syncedRundowns.keys()]
	}

	onConnected(cb: () => void): void {
		this.on('connected', cb)
	}

	onDisconnected(cb: () => void): void {
		this.on('disconnected', cb)
	}

	onError(cb: (err: Error | string) => void): void {
		this.on('error', cb)
	}

	onFailed(cb: (err: Error) => void): void {
		this.on('failed', cb)
	}

	async init(_ddpOptions?: DDPConnectorOptions): Promise<PeripheralDeviceId> {
		this._destroyed = false
		this._connected = true
		// Defer so CoreHandler can register onConnected before the event fires.
		queueMicrotask(() => {
			if (this._connected && !this._destroyed) {
				this.emit('connected')
			}
		})
		return this.deviceId
	}

	async destroy(): Promise<void> {
		this._destroyed = true
		if (this._connected) {
			this._connected = false
			this.emit('disconnected')
		}
		this.removeAllListeners()
	}

	async setStatus(status: unknown): Promise<unknown> {
		return this.coreMethods.setStatus(status as never)
	}

	async callMethodRaw(methodName: string, attrs: unknown[]): Promise<unknown> {
		if (this._destroyed) {
			throw new Error('callMethod: SimulatedCoreConnection has been destroyed')
		}
		if (!methodName) {
			throw new Error('callMethod: argument missing: methodName')
		}

		this._recordSyncEvent(methodName, attrs)

		switch (methodName) {
			case CORE_CONTENT_STATUS_METHOD: {
				const rundownExternalId = String(attrs[0] ?? '')
				return {
					rundownExternalId,
					// Empty pieces → readiness falls back to local filesystem checks.
					pieces: []
				}
			}
			case CORE_PLAYOUT_STATE_METHOD: {
				const rundownExternalId = String(attrs[0] ?? '')
				return {
					rundownExternalId,
					activated: false,
					rehearsal: false,
					previousPartExternalId: null,
					currentPartExternalId: null,
					nextPartExternalId: null
				}
			}
			case PeripheralDeviceAPIMethods.dataRundownCreate:
			case PeripheralDeviceAPIMethods.dataRundownUpdate: {
				const rundown = attrs[0] as { externalId?: string } | undefined
				const id = rundown?.externalId
				if (id) this._syncedRundowns.set(id, rundown)
				return undefined
			}
			case PeripheralDeviceAPIMethods.dataRundownDelete: {
				const id = String(attrs[0] ?? '')
				this._syncedRundowns.delete(id)
				return undefined
			}
			case PeripheralDeviceAPIMethods.dataSegmentCreate:
			case PeripheralDeviceAPIMethods.dataSegmentUpdate:
			case PeripheralDeviceAPIMethods.dataSegmentDelete:
			case PeripheralDeviceAPIMethods.dataSegmentRanksUpdate:
			case PeripheralDeviceAPIMethods.dataPartCreate:
			case PeripheralDeviceAPIMethods.dataPartUpdate:
			case PeripheralDeviceAPIMethods.dataPartDelete:
			case PeripheralDeviceAPIMethods.setStatus:
			case PeripheralDeviceAPIMethods.functionReply:
			case PeripheralDeviceAPIMethods.ping:
			case PeripheralDeviceAPIMethods.initialize:
			case PeripheralDeviceAPIMethods.unInitialize:
				return undefined
			case PeripheralDeviceAPIMethods.getPeripheralDevice:
				return {
					_id: this.deviceId,
					name: this._coreOptions.deviceName,
					studioId: protectString('simulated-studio')
				}
			default:
				// Accept unknown methods so optional Core probes do not break the sim.
				console.debug(`[simulate-sofie-core] accepting method ${methodName}`)
				return undefined
		}
	}

	async callMethodLowPrioRaw(methodName: string, attrs: unknown[]): Promise<unknown> {
		return this.callMethodRaw(methodName, attrs)
	}

	async autoSubscribe(_publicationName: string, ..._params: unknown[]): Promise<string> {
		return `sim-sub-${Date.now()}`
	}

	unsubscribe(_subscriptionId: string): void {
		// no-op
	}

	unsubscribeAll(): void {
		// no-op
	}

	observe(collectionName: string): Observer<SimulatedCollectionDoc> {
		const observer: Observer<SimulatedCollectionDoc> = {
			name: String(collectionName),
			id: protectString(`sim-observer-${collectionName}`),
			added: () => undefined,
			changed: () => undefined,
			removed: () => undefined,
			stop: () => undefined
		}
		return observer
	}

	getCollection(_collectionName: string): {
		find: (selector?: unknown) => SimulatedCollectionDoc[]
		findOne: (docId: unknown) => SimulatedCollectionDoc | undefined
	} {
		return {
			find: () => [],
			findOne: () => undefined
		}
	}

	getCurrentTime(): number {
		return Date.now()
	}

	hasSyncedTime(): boolean {
		return true
	}

	syncTimeQuality(): number | null {
		return 0
	}

	setPingResponse(_message: string): void {
		// no-op
	}

	private _recordSyncEvent(method: string, args: unknown[]): void {
		if (!method.startsWith('peripheralDevice.rundown.')) {
			return
		}
		this._recentSyncEvents.push({
			method,
			at: new Date().toISOString(),
			args
		})
		while (this._recentSyncEvents.length > SimulatedCoreConnection.MAX_SYNC_EVENTS) {
			this._recentSyncEvents.shift()
		}
		console.log(`[simulate-sofie-core] ${method}`)
	}
}
