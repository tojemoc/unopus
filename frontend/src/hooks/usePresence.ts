import { useEffect, useMemo, useRef } from 'react'
import { getSocket } from '~/lib/socket'
import { useAppDispatch, useAppSelector } from '~/store/app'
import {
	setPresenceFocuses,
	type PresenceEntityType,
	type PresenceFocus
} from '~/store/presence'
import { agentLog } from '~/debugAgentLog'

export function usePresenceSync(): void {
	const dispatch = useAppDispatch()

	useEffect(() => {
		const socket = getSocket()
		const onUpdate = (focuses: PresenceFocus[]) => {
			// #region agent log
			agentLog('C', 'usePresence.ts:presenceUpdate', 'presence:update received', {
				count: Array.isArray(focuses) ? focuses.length : -1
			})
			// #endregion
			dispatch(setPresenceFocuses(Array.isArray(focuses) ? focuses : []))
		}
		socket.on('presence:update', onUpdate)
		return () => {
			socket.off('presence:update', onUpdate)
		}
	}, [dispatch])
}

export function usePresenceFocus(
	rundownId: string | undefined,
	entityType: PresenceEntityType,
	entityId: string | undefined
): void {
	useEffect(() => {
		if (!rundownId || !entityId) {
			return
		}
		// #region agent log
			agentLog('C', 'usePresence.ts:focus', 'presence:focus emit', {
			entityType,
			entityId,
			rundownId,
			runId: 'post-fix-2'
		})
		// #endregion
		const socket = getSocket()
		socket.emit('presence:focus', { entityType, entityId, rundownId })
		return () => {
			socket.emit('presence:blur')
		}
	}, [rundownId, entityType, entityId])
}

export function useRowLocks(
	entityType: PresenceEntityType,
	entityId: string
): PresenceFocus[] {
	const selfId = useAppSelector((state) => state.auth.user?.id)
	const focuses = useAppSelector((state) => state.presence.focuses)
	const prevRef = useRef<PresenceFocus[] | null>(null)
	const locks = useMemo(
		() =>
			focuses.filter(
				(focus) =>
					focus.entityType === entityType &&
					focus.entityId === entityId &&
					focus.userId !== selfId
			),
		[focuses, entityType, entityId, selfId]
	)
	// #region agent log
	if (prevRef.current !== locks) {
		agentLog('C', 'usePresence.ts:useRowLocks', 'locks ref changed', {
			entityType,
			entityId,
			lockCount: locks.length,
			focusCount: focuses.length,
			runId: 'post-fix-2'
		})
		prevRef.current = locks
	}
	// #endregion
	return locks
}
