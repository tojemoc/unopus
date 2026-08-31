import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { usePresenceFocus } from '~/hooks/usePresence'

/** Part UI is inline in the script column; route kept for deep links / presence. */
export const Route = createFileRoute('/rundown/$rundownId/segment/$segmentId/part/$partId/')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, partId } = Route.useParams()
	const { setExpandedPartId } = useScriptExpand()

	usePresenceFocus(rundownId, 'part', partId)

	useEffect(() => {
		setExpandedPartId(partId)
		return () => setExpandedPartId(null)
	}, [partId, setExpandedPartId])

	return null
}
