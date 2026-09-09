import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { releasePresenceFocus, requestPresenceFocus } from '~/hooks/usePresence'
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
	const partExists = Boolean(part)

	const partsReady = partsStatus === 'succeeded' && partsRundownId === rundownId
	if (partsReady && !part) {
		throw redirect({ to: '/rundown/$rundownId/segment/$segmentId', params: { rundownId, segmentId } })
	}

	useEffect(() => {
		if (!partExists) return
		let cancelled = false
		const leaseId = crypto.randomUUID()
		void requestPresenceFocus({
			entityType: 'part',
			entityId: partId,
			rundownId,
			force: false,
			leaseId
		}).then((result) => {
			if (cancelled) {
				// Late acquire for this lease only — do not clear a newer lock.
				if (result.ok) {
					releasePresenceFocus(leaseId)
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
			releasePresenceFocus(leaseId)
			setExpandedPartId((prev) => (prev === partId ? null : prev))
		}
	}, [partId, partExists, rundownId, setExpandedPartId, toasts])

	return null
}
