import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { usePresenceFocus } from '~/hooks/usePresence'
import { useAppSelector } from '~/store/app'

/** Piece UI is inline in PartExpandedPanel; route kept for deep links / presence. */
export const Route = createFileRoute(
	'/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId'
)({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, segmentId, partId, pieceId } = Route.useParams()
	const { setExpandedPartId } = useScriptExpand()

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

	usePresenceFocus(rundownId, 'piece', pieceId)

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
		if (!part) return
		setExpandedPartId(partId)
		return () => setExpandedPartId(null)
	}, [partId, part, setExpandedPartId])

	return null
}
