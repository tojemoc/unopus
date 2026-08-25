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

function emit(): void {
	const snapshot = [...focuses.values()]
	for (const listener of listeners) {
		listener(snapshot)
	}
}

export function onPresenceChange(listener: PresenceListener): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function setPresenceFocus(focus: PresenceFocus): void {
	focuses.set(focus.socketId, focus)
	emit()
}

export function clearPresenceFocus(socketId: string): void {
	if (!focuses.delete(socketId)) {
		return
	}
	emit()
}

export function listPresenceFocuses(rundownId?: string): PresenceFocus[] {
	const all = [...focuses.values()]
	if (!rundownId) {
		return all
	}
	return all.filter((focus) => focus.rundownId === rundownId)
}

export function resetPresenceForTests(): void {
	focuses.clear()
}
