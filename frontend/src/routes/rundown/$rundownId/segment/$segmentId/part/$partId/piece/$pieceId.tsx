import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { requestPresenceFocus } from '~/hooks/usePresence'
import { getSocket } from '~/lib/socket'
import { useAppSelector } from '~/store/app'
import { useToasts } from '~/components/toasts/useToasts'

/** Piece UI is inline in PartExpandedPanel; route kept for deep links / presence. */
export const Route = createFileRoute(
	'/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId'
)({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, segmentId, partId, pieceId } = Route.useParams()
	const { setExpandedPartId } = useScriptExpand()
	const toasts = useToasts()

	const partsStatus = useAppSelector((state) => state.parts.status)
	const partsRundownId = useAppSelector((state) => state.parts.rundownId)
	const piecesStatus = useAppSelector((state) => state.pieces.status)
	const piecesRundownId = useAppSelector((state) => state.pieces.rundownId)
	const part = useAppSelector((state) =>
		state.parts.parts.find(
			(p) => p.id === partId && p.rundownId === rundownId && p.segmentId === segmentId
		)
	)
	const piece = useAppSelector((state) =>
		state.pieces.pieces.find(
			(p) => p.id === pieceId && p.partId === partId && p.rundownId === rundownId
		)
	)
	const partExists = Boolean(part)

	const partsReady = partsStatus === 'succeeded' && partsRundownId === rundownId
	const piecesReady = piecesStatus === 'succeeded' && piecesRundownId === rundownId

	if (partsReady && !part) {
		throw redirect({ to: '/rundown/$rundownId/segment/$segmentId', params: { rundownId, segmentId } })
	}

	if (partsReady && piecesReady && part && !piece) {
		throw redirect({
			to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
			params: { rundownId, segmentId, partId }
		})
	}

	useEffect(() => {
		if (!partExists) return
		let cancelled = false
		// Story lock is on the part; piece deep-links still need the story expander.
		void requestPresenceFocus({
			entityType: 'part',
			entityId: partId,
			rundownId,
			force: false
		}).then((result) => {
			if (cancelled) {
				// Focus may have been acquired after cleanup — release it.
				if (result.ok) {
					getSocket().emit('presence:blur')
				}
				return
			}
			if (result.ok || result.reason === 'unavailable') {
				setExpandedPartId(partId)
				return
			}
			toasts.show({
				headerContent: 'Story is locked',
				bodyContent: `${result.holder.displayName || 'Another user'} is editing this story. Open it from the list to take over.`
			})
		})
		return () => {
			cancelled = true
			getSocket().emit('presence:blur')
			setExpandedPartId((prev) => (prev === partId ? null : prev))
		}
	}, [partId, partExists, rundownId, setExpandedPartId, toasts])

	return null
}
