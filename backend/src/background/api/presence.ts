import type { Server, Socket } from 'socket.io'
import type { AuthenticatedSocket } from '../auth/socketAuth'
import {
	clearPresenceFocus,
	listPresenceFocuses,
	onPresenceChange,
	trySetPresenceFocus,
	type PresenceEntityType,
	type PresenceFocusResult
} from '../presence'

/**
 * Type guard to validate presence entity type.
 */
function isEntityType(value: unknown): value is PresenceEntityType {
	return value === 'part' || value === 'piece'
}

type FocusPayload = {
	entityType?: unknown
	entityId?: unknown
	rundownId?: unknown
	force?: unknown
	leaseId?: unknown
}

type BlurPayload = {
	leaseId?: unknown
}

type FocusAck = (result: PresenceFocusResult) => void

/**
 * Register Socket.IO handlers for presence tracking (focus/blur/disconnect).
 */
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

	socket.on('presence:focus', (payload: FocusPayload, ack?: FocusAck) => {
		if (!isEntityType(payload?.entityType)) {
			ack?.({
				ok: false,
				reason: 'locked',
				holder: { socketId: '', userId: '', displayName: 'Unknown' }
			})
			return
		}
		if (typeof payload.entityId !== 'string' || !payload.entityId) {
			ack?.({
				ok: false,
				reason: 'locked',
				holder: { socketId: '', userId: '', displayName: 'Unknown' }
			})
			return
		}
		if (typeof payload.rundownId !== 'string' || !payload.rundownId) {
			ack?.({
				ok: false,
				reason: 'locked',
				holder: { socketId: '', userId: '', displayName: 'Unknown' }
			})
			return
		}
		if (typeof payload.leaseId !== 'string' || !payload.leaseId) {
			ack?.({
				ok: false,
				reason: 'locked',
				holder: { socketId: '', userId: '', displayName: 'Unknown' }
			})
			return
		}

		const force = payload.force === true
		const result = trySetPresenceFocus(
			{
				socketId: socket.id,
				userId: user.id,
				displayName: user.displayName,
				entityType: payload.entityType,
				entityId: payload.entityId,
				rundownId: payload.rundownId,
				leaseId: payload.leaseId
			},
			{ force }
		)

		if (result.ok) {
			for (const evicted of result.evicted) {
				io.to(evicted.socketId).emit('presence:evicted', {
					entityType: evicted.entityType,
					entityId: evicted.entityId,
					rundownId: evicted.rundownId,
					byDisplayName: user.displayName
				})
			}
		}

		ack?.(result)
	})

	socket.on('presence:blur', (payload?: BlurPayload) => {
		const leaseId = typeof payload?.leaseId === 'string' ? payload.leaseId : undefined
		clearPresenceFocus(socket.id, leaseId)
	})

	socket.on('disconnect', () => {
		unsubscribe()
		clearPresenceFocus(socket.id)
	})
}
