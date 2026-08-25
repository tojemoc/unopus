import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { usePresenceFocus } from '~/hooks/usePresence'
import { useAppSelector } from '~/store/app'

/** Piece editing is inline in `PartExpandedPanel`; keep route for presence / deep links. */
export const Route = createFileRoute(
	'/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId'
)({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, segmentId, partId, pieceId } = Route.useParams()
	const navigate = Route.useNavigate()
	usePresenceFocus(rundownId, 'piece', pieceId)

	const piece = useAppSelector((state) =>
		state.pieces.pieces.find(
			(s) =>
				s.rundownId === rundownId &&
				s.segmentId === segmentId &&
				s.partId === partId &&
				s.id === pieceId
		)
	)

	useEffect(() => {
		if (!piece) {
			void navigate({
				to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
				params: { rundownId, segmentId, partId }
			})
		}
	}, [piece, navigate, rundownId, segmentId, partId])

	return null
}
