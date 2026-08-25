import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { usePresenceFocus } from '~/hooks/usePresence'
import { useAppSelector } from '~/store/app'

/**
 * Part detail is shown inline in the script column (`PartExpandedPanel`).
 * This route exists for deep links / presence and renders nothing.
 */
export const Route = createFileRoute('/rundown/$rundownId/segment/$segmentId/part/$partId/')({
	component: RouteComponent
})

function RouteComponent() {
	const navigate = useNavigate()
	const { rundownId, segmentId, partId } = Route.useParams()

	usePresenceFocus(rundownId, 'part', partId)

	const part = useAppSelector((state) =>
		state.parts.parts.find(
			(s) => s.rundownId === rundownId && s.segmentId === segmentId && s.id === partId
		)
	)

	useEffect(() => {
		if (!part) {
			void navigate({
				to: `/rundown/${rundownId}/segment/${segmentId}`
			})
		}
	}, [part, navigate, rundownId, segmentId])

	return null
}
