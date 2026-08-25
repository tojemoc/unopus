import { createFileRoute } from '@tanstack/react-router'
import { usePresenceFocus } from '~/hooks/usePresence'

/** Piece UI is inline in PartExpandedPanel; route kept for deep links / presence. */
export const Route = createFileRoute(
	'/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId'
)({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, pieceId } = Route.useParams()
	usePresenceFocus(rundownId, 'piece', pieceId)
	return null
}
