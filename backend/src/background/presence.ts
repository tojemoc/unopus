/**
 * In-memory occupancy for rundown rows (parts / pieces).
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
}

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
 * Set or update the presence focus for a socket connection.
 */
export function setPresenceFocus(focus: PresenceFocus): void {
	focuses.set(focus.socketId, focus)
	emit()
}

/**
 * Remove the presence focus for a socket connection.
 */
export function clearPresenceFocus(socketId: string): void {
	if (!focuses.delete(socketId)) {
		return
	}
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
