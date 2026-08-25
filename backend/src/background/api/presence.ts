import type { Server, Socket } from 'socket.io'
import type { AuthenticatedSocket } from '../auth/socketAuth'
import {
	clearPresenceFocus,
	listPresenceFocuses,
	onPresenceChange,
	setPresenceFocus,
	type PresenceEntityType
} from '../presence'

function isEntityType(value: unknown): value is PresenceEntityType {
	return value === 'part' || value === 'piece'
}

export function registerPresenceHandlers(socket: Socket, io: Server): void {
	const authSocket = socket as AuthenticatedSocket
	const user = authSocket.data.user
	if (!user) {
		return
	}

	const unsubscribe = onPresenceChange((focuses) => {
		socket.emit('presence:update', focuses)
	})

	socket.emit('presence:update', listPresenceFocuses())

	socket.on(
		'presence:focus',
		(payload: { entityType?: unknown; entityId?: unknown; rundownId?: unknown }) => {
			if (!isEntityType(payload?.entityType)) {
				return
			}
			if (typeof payload.entityId !== 'string' || !payload.entityId) {
				return
			}
			if (typeof payload.rundownId !== 'string' || !payload.rundownId) {
				return
			}
			setPresenceFocus({
				socketId: socket.id,
				userId: user.id,
				displayName: user.displayName,
				entityType: payload.entityType,
				entityId: payload.entityId,
				rundownId: payload.rundownId
			})
		}
	)

	socket.on('presence:blur', () => {
		clearPresenceFocus(socket.id)
	})

	socket.on('disconnect', () => {
		unsubscribe()
		clearPresenceFocus(socket.id)
	})

	void io
}
