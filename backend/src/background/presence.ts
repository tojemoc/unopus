/**
 * In-memory occupancy for rundown rows (parts / pieces).
 * Enforces exclusive edit locks so only one foreign user can hold a row at a time.
 * Broadcasts who is currently looking at which row so the UI can show a lock chip.
 */

export type PresenceEntityType = 'part' | 'piece'

export interface PresenceFocus {
	socketId: string
	userId: string
	displayName: string
	entityType: PresenceEntityType
	entityId: string
	rundownId: string
	/** Client-generated lease; blur with this id only clears a matching acquisition. */
	leaseId: string
}

export interface PresenceLockHolder {
	socketId: string
	userId: string
	displayName: string
}

export type PresenceFocusResult =
	| { ok: true; evicted: PresenceFocus[]; leaseId: string }
	| { ok: false; reason: 'locked'; holder: PresenceLockHolder }

type PresenceListener = (focuses: PresenceFocus[]) => void

const focuses = new Map<string, PresenceFocus>()
const listeners = new Set<PresenceListener>()

/**
 * Notify all registered listeners with the current presence snapshot.
 */
function emit(): void {
	const snapshot = [...focuses.values()]
	for (const listener of listeners) {
		listener(snapshot)
	}
}

/**
 * Register a listener for presence changes. Returns unsubscribe function.
 */
export function onPresenceChange(listener: PresenceListener): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

/**
 * Find sockets currently focused on the same entity (excluding `socketId`).
 */
function holdersForEntity(
	entityType: PresenceEntityType,
	entityId: string,
	exceptSocketId: string
): PresenceFocus[] {
	return [...focuses.values()].filter(
		(focus) =>
			focus.entityType === entityType &&
			focus.entityId === entityId &&
			focus.socketId !== exceptSocketId
	)
}

/**
 * Set or update the presence focus for a socket connection (unconditional).
 * Prefer {@link trySetPresenceFocus} for exclusive locking.
 */
export function setPresenceFocus(focus: PresenceFocus): void {
	focuses.set(focus.socketId, focus)
	emit()
}

/**
 * Attempt to acquire an exclusive presence focus on an entity.
 *
 * - Same user on another tab is auto-evicted (no confirmation needed).
 * - A different user blocks unless `force` is true (kick / takeover).
 */
export function trySetPresenceFocus(
	focus: PresenceFocus,
	options?: { force?: boolean }
): PresenceFocusResult {
	const holders = holdersForEntity(focus.entityType, focus.entityId, focus.socketId)
	const foreignHolders = holders.filter((holder) => holder.userId !== focus.userId)

	if (foreignHolders.length > 0 && !options?.force) {
		const holder = foreignHolders[0]
		return {
			ok: false,
			reason: 'locked',
			holder: {
				socketId: holder.socketId,
				userId: holder.userId,
				displayName: holder.displayName
			}
		}
	}

	const toEvict = options?.force ? holders : holders.filter((holder) => holder.userId === focus.userId)
	for (const holder of toEvict) {
		focuses.delete(holder.socketId)
	}

	focuses.set(focus.socketId, focus)
	emit()
	return { ok: true, evicted: toEvict, leaseId: focus.leaseId }
}

/**
 * Remove the presence focus for a socket connection.
 * When `leaseId` is provided, only clears if it matches the current acquisition.
 */
export function clearPresenceFocus(socketId: string, leaseId?: string): void {
	const current = focuses.get(socketId)
	if (!current) {
		return
	}
	if (leaseId !== undefined && current.leaseId !== leaseId) {
		return
	}
	focuses.delete(socketId)
	emit()
}

/**
 * List all active presence focuses, optionally filtered by rundown.
 */
export function listPresenceFocuses(rundownId?: string): PresenceFocus[] {
	const all = [...focuses.values()]
	if (!rundownId) {
		return all
	}
	return all.filter((focus) => focus.rundownId === rundownId)
}

/**
 * Clear all presence data. Test-only utility.
 */
export function resetPresenceForTests(): void {
	focuses.clear()
}
