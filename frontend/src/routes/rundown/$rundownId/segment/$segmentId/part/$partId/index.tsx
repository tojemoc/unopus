import { createFileRoute } from '@tanstack/react-router'
import { usePresenceFocus } from '~/hooks/usePresence'

/** Part UI is inline in the script column; route kept for deep links / presence. */
export const Route = createFileRoute('/rundown/$rundownId/segment/$segmentId/part/$partId/')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, partId } = Route.useParams()
	usePresenceFocus(rundownId, 'part', partId)
	return null
}
