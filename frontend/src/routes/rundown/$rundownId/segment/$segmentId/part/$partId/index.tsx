import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { usePresenceFocus } from '~/hooks/usePresence'
import { useAppSelector } from '~/store/app'

/** Part UI is inline in the script column; route kept for deep links / presence. */
export const Route = createFileRoute('/rundown/$rundownId/segment/$segmentId/part/$partId/')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, segmentId, partId } = Route.useParams()
	const { setExpandedPartId } = useScriptExpand()

	const partsStatus = useAppSelector((state) => state.parts.status)
	const partsRundownId = useAppSelector((state) => state.parts.rundownId)
	const part = useAppSelector((state) =>
		state.parts.parts.find(
			(p) => p.id === partId && p.rundownId === rundownId && p.segmentId === segmentId
		)
	)

	usePresenceFocus(rundownId, 'part', partId)

	const partsReady = partsStatus === 'succeeded' && partsRundownId === rundownId
	if (partsReady && !part) {
		throw redirect({ to: '/rundown/$rundownId/segment/$segmentId', params: { rundownId, segmentId } })
	}

	useEffect(() => {
		if (!part) return
		setExpandedPartId(partId)
		return () => setExpandedPartId(null)
	}, [partId, part, setExpandedPartId])

	return null
}
