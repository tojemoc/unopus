import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AppShell } from '~/components/layout/AppShell'
import { RundownSidebar } from '~/components/rundown/sidebar'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { loadParts } from '~/store/parts'
import { loadPieces } from '~/store/pieces'
import { loadSegments } from '~/store/segments'
import { MyErrorBoundary } from '~/util/errorBoundary'
import { RundownReadinessProvider } from '~/hooks/RundownReadinessContext'
import { ScriptExpandProvider } from '~/hooks/ScriptExpandContext'

export const Route = createFileRoute('/rundown/$rundownId')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId } = Route.useParams()
	const matchRoute = useMatchRoute()
	const isRewriteView = Boolean(
		matchRoute({ to: '/rundown/$rundownId/rewrite', params: { rundownId } })
	)

	const dispatch = useAppDispatch()
	// Select primitives individually — a new object from the selector would fail
	// useAppSelector's === check on every store update (e.g. presence:update) and
	// re-render this route, remounting inline DraggableContainer children in a loop.
	const segmentsStatus = useAppSelector((state) => state.segments.status)
	const segmentsRundownId = useAppSelector((state) => state.segments.rundownId)
	const partsStatus = useAppSelector((state) => state.parts.status)
	const partsRundownId = useAppSelector((state) => state.parts.rundownId)
	const piecesStatus = useAppSelector((state) => state.pieces.status)
	const piecesRundownId = useAppSelector((state) => state.pieces.rundownId)

	useEffect(() => {
		if (segmentsStatus === 'idle' || segmentsRundownId !== rundownId) {
			dispatch(loadSegments({ rundownId }))
		}
		if (partsStatus === 'idle' || partsRundownId !== rundownId) {
			dispatch(loadParts({ rundownId }))
		}
		if (piecesStatus === 'idle' || piecesRundownId !== rundownId) {
			dispatch(loadPieces({ rundownId }))
		}
	}, [
		segmentsStatus,
		segmentsRundownId,
		partsStatus,
		partsRundownId,
		piecesStatus,
		piecesRundownId,
		rundownId,
		dispatch
	])

	const rundown = useAppSelector((state) => state.rundowns.find((r) => r.id === rundownId))
	if (!rundown) {
		return (
			<AppShell>
				<div className="app-page p-3">Rundown not found</div>
			</AppShell>
		)
	}

	return (
		<RundownReadinessProvider rundownId={rundown.id}>
			<ScriptExpandProvider>
				<AppShell rundown={rundown}>
					{isRewriteView ? (
						<div className="rundown-rewrite-column">
							<MyErrorBoundary>
								<Outlet />
							</MyErrorBoundary>
						</div>
					) : (
						<>
							<div className="rundown-script-column">
								<RundownSidebar rundownId={rundown.id} playlistId={rundown.playlistId} />
							</div>

							{/* Part/piece/index child routes stay mounted for presence; UI is inline in the script column. */}
							<div hidden aria-hidden>
								<MyErrorBoundary>
									<Outlet />
								</MyErrorBoundary>
							</div>
						</>
					)}
				</AppShell>
			</ScriptExpandProvider>
		</RundownReadinessProvider>
	)
}
