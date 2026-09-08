import { useEffect, useMemo } from 'react'
import { getSocket } from '~/lib/socket'
import { useAppDispatch, useAppSelector } from '~/store/app'
import {
	setPresenceFocuses,
	type PresenceEntityType,
	type PresenceFocus
} from '~/store/presence'

export interface PresenceLockHolder {
	socketId: string
	userId: string
	displayName: string
}

export type PresenceFocusResult =
	| { ok: true; evicted?: PresenceFocus[] }
	| { ok: false; reason: 'locked'; holder: PresenceLockHolder }
	| { ok: false; reason: 'unavailable' }

export type PresenceEvictedPayload = {
	entityType: PresenceEntityType
	entityId: string
	rundownId: string
	byDisplayName?: string
}

const FOCUS_ACK_TIMEOUT_MS = 4000

/**
 * Wait until the shared socket is connected (or timeout).
 */
async function whenSocketConnected(timeoutMs = FOCUS_ACK_TIMEOUT_MS): Promise<boolean> {
	const socket = getSocket()
	if (socket.connected) {
		return true
	}
	return await new Promise<boolean>((resolve) => {
		const timer = window.setTimeout(() => {
			socket.off('connect', onConnect)
			resolve(false)
		}, timeoutMs)
		const onConnect = () => {
			window.clearTimeout(timer)
			resolve(true)
		}
		socket.once('connect', onConnect)
		// In case connect raced between the check and once()
		if (socket.connected) {
			window.clearTimeout(timer)
			socket.off('connect', onConnect)
			resolve(true)
		}
	})
}

/**
 * Request an exclusive presence focus (edit lock) for a part or piece.
 * Pass `force: true` to kick the current holder (possible unsaved data loss for them).
 */
export async function requestPresenceFocus(args: {
	entityType: PresenceEntityType
	entityId: string
	rundownId: string
	force?: boolean
}): Promise<PresenceFocusResult> {
	const connected = await whenSocketConnected()
	if (!connected) {
		return { ok: false, reason: 'unavailable' }
	}

	const socket = getSocket()
	const payload = {
		entityType: args.entityType,
		entityId: args.entityId,
		rundownId: args.rundownId,
		force: args.force === true
	}

	try {
		const result = (await Promise.race([
			socket.emitWithAck('presence:focus', payload),
			new Promise<undefined>((resolve) => {
				window.setTimeout(() => resolve(undefined), FOCUS_ACK_TIMEOUT_MS)
			})
		])) as PresenceFocusResult | undefined

		if (!result || typeof result !== 'object' || !('ok' in result)) {
			return { ok: false, reason: 'unavailable' }
		}
		return result
	} catch (error) {
		console.error('presence:focus failed', error)
		return { ok: false, reason: 'unavailable' }
	}
}

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
 * Renews the lock while the editor is mounted; does not force-takeover.
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
		void requestPresenceFocus({ entityType, entityId, rundownId, force: false })
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
	const focuses = useAppSelector((state) => state.presence.focuses)
	return useMemo(
		() =>
			focuses.filter(
				(focus) =>
					focus.entityType === entityType &&
					focus.entityId === entityId &&
					focus.userId !== selfId
			),
		[focuses, entityType, entityId, selfId]
	)
}
