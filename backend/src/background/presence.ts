/**
 * In-memory occupancy for rundown rows (parts / pieces).
 * Enforces exclusive edit locks so only one foreign user can hold a row at a time.
 * Broadcasts who is currently looking at which row so the UI can show a lock chip.
 *
 * Sofie playout also places non-kickable "System" locks on previous / current / next parts.
 */

export type PresenceEntityType = 'part' | 'piece'

export const SYSTEM_USER_ID = 'system'
export const SYSTEM_DISPLAY_NAME = 'System'

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
 * True when the focus belongs to the Sofie playout System user.
 */
export function isSystemPresenceFocus(focus: Pick<PresenceFocus, 'userId'>): boolean {
	return focus.userId === SYSTEM_USER_ID
}

/**
 * Synthetic socket id so System can hold multiple part locks at once.
 */
export function systemPresenceSocketId(entityType: PresenceEntityType, entityId: string): string {
	return `system:${entityType}:${entityId}`
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
 * - System (playout) locks always block — even with `force`.
 */
export function trySetPresenceFocus(
	focus: PresenceFocus,
	options?: { force?: boolean }
): PresenceFocusResult {
	const holders = holdersForEntity(focus.entityType, focus.entityId, focus.socketId)
	const foreignHolders = holders.filter((holder) => holder.userId !== focus.userId)
	const systemHolders = foreignHolders.filter(isSystemPresenceFocus)
	const kickableForeignHolders = foreignHolders.filter((holder) => !isSystemPresenceFocus(holder))

	if (systemHolders.length > 0) {
		const holder = systemHolders[0]
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

	if (kickableForeignHolders.length > 0 && !options?.force) {
		const holder = kickableForeignHolders[0]
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

	const toEvict = options?.force
		? holders.filter((holder) => !isSystemPresenceFocus(holder))
		: holders.filter((holder) => holder.userId === focus.userId)
	for (const holder of toEvict) {
		focuses.delete(holder.socketId)
	}

	focuses.set(focus.socketId, focus)
	emit()
	return { ok: true, evicted: toEvict, leaseId: focus.leaseId }
}

/**
 * Replace System part locks for a rundown with `partIds` (previous / current / next).
 * Pass an empty list to clear all System locks for that rundown.
 */
export function syncSystemPartLocks(rundownId: string, partIds: string[]): void {
	const desired = new Set(partIds.filter(Boolean))
	let changed = false

	for (const [socketId, focus] of focuses) {
		if (focus.rundownId !== rundownId || !isSystemPresenceFocus(focus) || focus.entityType !== 'part') {
			continue
		}
		if (!desired.has(focus.entityId)) {
			focuses.delete(socketId)
			changed = true
		}
	}

	for (const partId of desired) {
		const socketId = systemPresenceSocketId('part', partId)
		const existing = focuses.get(socketId)
		if (
			existing &&
			existing.rundownId === rundownId &&
			existing.entityType === 'part' &&
			existing.entityId === partId &&
			isSystemPresenceFocus(existing)
		) {
			continue
		}

		// Evict any non-system holders on this part — playout lock wins.
		for (const holder of holdersForEntity('part', partId, socketId)) {
			if (!isSystemPresenceFocus(holder)) {
				focuses.delete(holder.socketId)
				changed = true
			}
		}

		focuses.set(socketId, {
			socketId,
			userId: SYSTEM_USER_ID,
			displayName: SYSTEM_DISPLAY_NAME,
			entityType: 'part',
			entityId: partId,
			rundownId,
			leaseId: `system-lease-${partId}`
		})
		changed = true
	}

	if (changed) {
		emit()
	}
}

/**
 * Remove the presence focus for a socket connection.
 * When `leaseId` is provided, only clears if it matches the current acquisition.
 * System locks are ignored (they are not tied to real client sockets).
 */
export function clearPresenceFocus(socketId: string, leaseId?: string): void {
	if (socketId.startsWith('system:')) {
		return
	}
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
