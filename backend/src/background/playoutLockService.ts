import { db } from './db'
import { fetchCorePlayoutStateForRundown, type CoreRundownPlayoutState } from './corePlayoutState'
import { syncSystemPartLocks } from './presence'
import { getSocketIO } from './socket'

const POLL_INTERVAL_MS = 1000

export interface RundownPlayoutUpdate {
	rundownId: string
	activated: boolean
	rehearsal: boolean
	previousPartId: string | null
	currentPartId: string | null
	nextPartId: string | null
	/** Segment that contains the current on-air part, when resolvable in RE. */
	currentSegmentId: string | null
	lockedPartIds: string[]
}

let intervalHandle: ReturnType<typeof setInterval> | undefined
const lastPayloadByRundown = new Map<string, string>()

/**
 * Resolve the RE segment id that owns a part (same as Sofie external id).
 */
function segmentIdForPart(partId: string): string | null {
	const row = db.prepare(`SELECT segmentId FROM parts WHERE id = ?`).get(partId) as
		| { segmentId: string | null }
		| undefined
	return row?.segmentId ?? null
}

/**
 * List rundown ids that are marked sync=true (ingested into Sofie).
 */
function listSyncedRundownIds(): string[] {
	const rows = db
		.prepare(
			`SELECT id FROM rundowns WHERE COALESCE(json_extract(document, '$.sync'), 0) = 1
			 AND COALESCE(json_extract(document, '$.isTemplate'), 0) = 0`
		)
		.all() as Array<{ id: string }>
	return rows.map((row) => row.id)
}

function lockedPartIdsFromState(state: CoreRundownPlayoutState): string[] {
	if (!state.activated) {
		return []
	}
	const ids = [
		state.previousPartExternalId,
		state.currentPartExternalId,
		state.nextPartExternalId
	].filter((id): id is string => typeof id === 'string' && id.length > 0)
	return [...new Set(ids)]
}

function toUpdate(rundownId: string, state: CoreRundownPlayoutState): RundownPlayoutUpdate {
	const lockedPartIds = lockedPartIdsFromState(state)
	return {
		rundownId,
		activated: state.activated,
		rehearsal: state.rehearsal,
		previousPartId: state.previousPartExternalId,
		currentPartId: state.currentPartExternalId,
		nextPartId: state.nextPartExternalId,
		currentSegmentId: state.currentPartExternalId
			? segmentIdForPart(state.currentPartExternalId)
			: null,
		lockedPartIds
	}
}

function publishUpdate(update: RundownPlayoutUpdate): void {
	const serialized = JSON.stringify(update)
	if (lastPayloadByRundown.get(update.rundownId) === serialized) {
		return
	}
	lastPayloadByRundown.set(update.rundownId, serialized)

	syncSystemPartLocks(update.rundownId, update.lockedPartIds)

	const socketIO = getSocketIO()
	if (socketIO) {
		socketIO.emit('playout:update', update)
	}
}

function clearRundownPlayout(rundownId: string): void {
	publishUpdate({
		rundownId,
		activated: false,
		rehearsal: false,
		previousPartId: null,
		currentPartId: null,
		nextPartId: null,
		currentSegmentId: null,
		lockedPartIds: []
	})
}

/**
 * Poll Core once for every synced rundown and refresh System locks / on-air state.
 */
export async function refreshPlayoutLocksFromCore(): Promise<void> {
	const syncedIds = listSyncedRundownIds()
	const seen = new Set(syncedIds)

	for (const rundownId of syncedIds) {
		const result = await fetchCorePlayoutStateForRundown(rundownId)
		if (result.source !== 'core') {
			// Keep last known locks if Core is briefly unavailable; clear only on explicit inactive.
			continue
		}
		publishUpdate(toUpdate(rundownId, result.state))
	}

	for (const rundownId of lastPayloadByRundown.keys()) {
		if (!seen.has(rundownId)) {
			clearRundownPlayout(rundownId)
			lastPayloadByRundown.delete(rundownId)
		}
	}
}

/**
 * Start the Sofie playout → System lock bridge. Idempotent.
 */
export function startPlayoutLockService(): void {
	if (intervalHandle) {
		return
	}
	void refreshPlayoutLocksFromCore()
	intervalHandle = setInterval(() => {
		void refreshPlayoutLocksFromCore()
	}, POLL_INTERVAL_MS)
}

/**
 * Snapshot of the last published playout payloads (for late-joining sockets).
 */
export function listCachedPlayoutUpdates(): RundownPlayoutUpdate[] {
	const updates: RundownPlayoutUpdate[] = []
	for (const serialized of lastPayloadByRundown.values()) {
		try {
			updates.push(JSON.parse(serialized) as RundownPlayoutUpdate)
		} catch {
			// ignore corrupt cache entries
		}
	}
	return updates
}

/**
 * Stop the playout lock poller. Test helper.
 */
export function stopPlayoutLockServiceForTests(): void {
	if (intervalHandle) {
		clearInterval(intervalHandle)
		intervalHandle = undefined
	}
	lastPayloadByRundown.clear()
}
