import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useRef, type CSSProperties } from 'react'
import { DuopusNavbar } from '~/components/navbar/duopusNavbar'
import { RundownNavbar } from '~/components/rundown/navbar'
import { RundownSidebar } from '~/components/rundown/sidebar'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { loadParts } from '~/store/parts'
import { loadPieces } from '~/store/pieces'
import { loadSegments } from '~/store/segments'
import { MyErrorBoundary } from '~/util/errorBoundary'
import { RundownReadinessProvider } from '~/hooks/RundownReadinessContext'
import { agentLog } from '~/debugAgentLog'

export const Route = createFileRoute('/rundown/$rundownId')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId } = Route.useParams()

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

	// #region agent log
	const routeRenderRef = useRef(0)
	routeRenderRef.current += 1
	if (routeRenderRef.current <= 20 || routeRenderRef.current % 25 === 0) {
		agentLog('F', 'rundownId.tsx:render', 'Rundown route render', {
			rundownId,
			renderN: routeRenderRef.current,
			runId: 'post-fix-2'
		})
	}
	// #endregion

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
			<>
				<DuopusNavbar />
				<div>Rundown not found</div>
			</>
		)
	}

	return (
		<RundownReadinessProvider rundownId={rundown.id}>
			<div style={rootStyle}>
				<div style={headerStyle}>
					<DuopusNavbar rundownName={rundown.name} />
					<RundownNavbar rundown={rundown} />
				</div>

				<div className="rundown-script-column">
					<RundownSidebar rundownId={rundown.id} playlistId={rundown.playlistId} />
				</div>

				{/* Child routes stay mounted for presence; UI is inline in the script column. */}
				<div hidden aria-hidden>
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</div>
		</RundownReadinessProvider>
	)
}

const rootStyle: CSSProperties = {
	display: 'grid',
	height: '100%',
	gridTemplateRows: 'auto 1fr',
	gridTemplateColumns: '1fr',
	overflowX: 'hidden',
	position: 'relative'
}

const headerStyle: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	flexShrink: 0,
	gridColumn: '1 / -1'
}
