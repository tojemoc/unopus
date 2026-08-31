import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { usePresenceFocus } from '~/hooks/usePresence'

/** Piece UI is inline in PartExpandedPanel; route kept for deep links / presence. */
export const Route = createFileRoute(
	'/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId'
)({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, partId, pieceId } = Route.useParams()
	const { setExpandedPartId } = useScriptExpand()

	usePresenceFocus(rundownId, 'piece', pieceId)

	useEffect(() => {
		setExpandedPartId(partId)
		return () => setExpandedPartId(null)
	}, [partId, setExpandedPartId])

	return null
}
