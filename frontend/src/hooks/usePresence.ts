import { useEffect } from 'react'
import { getSocket } from '~/lib/socket'
import { useAppDispatch, useAppSelector } from '~/store/app'
import {
	setPresenceFocuses,
	type PresenceEntityType,
	type PresenceFocus
} from '~/store/presence'

/**
 * Subscribe to presence updates from the server and sync to Redux store.
 */
export function usePresenceSync(): void {
	const dispatch = useAppDispatch()

	useEffect(() => {
		const socket = getSocket()
		const onUpdate = (focuses: PresenceFocus[]) => {
			dispatch(setPresenceFocuses(Array.isArray(focuses) ? focuses : []))
		}
		socket.on('presence:update', onUpdate)
		return () => {
			socket.off('presence:update', onUpdate)
		}
	}, [dispatch])
}

/**
 * Emit presence focus for the current component and clear on unmount.
 */
export function usePresenceFocus(
	rundownId: string | undefined,
	entityType: PresenceEntityType,
	entityId: string | undefined
): void {
	useEffect(() => {
		if (!rundownId || !entityId) {
			return
		}
		const socket = getSocket()
		socket.emit('presence:focus', { entityType, entityId, rundownId })
		return () => {
			socket.emit('presence:blur')
		}
	}, [rundownId, entityType, entityId])
}

/**
 * Get all presence focuses for a specific row, excluding self.
 * Used to show who else is viewing/editing a part or piece.
 */
export function useRowLocks(
	entityType: PresenceEntityType,
	entityId: string
): PresenceFocus[] {
	const selfId = useAppSelector((state) => state.auth.user?.id)
	return useAppSelector((state) =>
		state.presence.focuses.filter(
			(focus) =>
				focus.entityType === entityType &&
				focus.entityId === entityId &&
				focus.userId !== selfId
		)
	)
}
