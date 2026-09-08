import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { requestPresenceFocus } from '~/hooks/usePresence'
import { useAppSelector } from '~/store/app'
import { useToasts } from '~/components/toasts/useToasts'

/** Part UI is inline in the script column; route kept for deep links / presence. */
export const Route = createFileRoute('/rundown/$rundownId/segment/$segmentId/part/$partId/')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, segmentId, partId } = Route.useParams()
	const { setExpandedPartId } = useScriptExpand()
	const toasts = useToasts()

	const partsStatus = useAppSelector((state) => state.parts.status)
	const partsRundownId = useAppSelector((state) => state.parts.rundownId)
	const part = useAppSelector((state) =>
		state.parts.parts.find(
			(p) => p.id === partId && p.rundownId === rundownId && p.segmentId === segmentId
		)
	)

	const partsReady = partsStatus === 'succeeded' && partsRundownId === rundownId
	if (partsReady && !part) {
		throw redirect({ to: '/rundown/$rundownId/segment/$segmentId', params: { rundownId, segmentId } })
	}

	useEffect(() => {
		if (!part) return
		let cancelled = false
		void requestPresenceFocus({
			entityType: 'part',
			entityId: partId,
			rundownId,
			force: false
		}).then((result) => {
			if (cancelled) return
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
			setExpandedPartId((prev) => (prev === partId ? null : prev))
		}
	}, [partId, part, rundownId, setExpandedPartId, toasts])

	return null
}
