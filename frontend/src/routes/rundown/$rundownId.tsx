import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, type CSSProperties } from 'react'
import { DuopusNavbar } from '~/components/navbar/duopusNavbar'
import { RundownNavbar } from '~/components/rundown/navbar'
import { RundownSidebar } from '~/components/rundown/sidebar'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { loadParts } from '~/store/parts'
import { loadPieces } from '~/store/pieces'
import { loadSegments } from '~/store/segments'
import { MyErrorBoundary } from '~/util/errorBoundary'
import { RundownReadinessProvider } from '~/hooks/RundownReadinessContext'

export const Route = createFileRoute('/rundown/$rundownId')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId } = Route.useParams()
	const pathname = useRouterState({ select: (s) => s.location.pathname })

	const dispatch = useAppDispatch()
	const loadStatus = useAppSelector((state) => ({
		segmentsStatus: state.segments.status,
		segmentsRundownId: state.segments.rundownId,
		partsStatus: state.parts.status,
		partsRundownId: state.parts.rundownId,
		piecesStatus: state.pieces.status,
		piecesRundownId: state.pieces.rundownId
	}))

	useEffect(() => {
		if (loadStatus.segmentsStatus === 'idle' || loadStatus.segmentsRundownId !== rundownId) {
			dispatch(loadSegments({ rundownId }))
		}
		if (loadStatus.partsStatus === 'idle' || loadStatus.partsRundownId !== rundownId) {
			dispatch(loadParts({ rundownId }))
		}
		if (loadStatus.piecesStatus === 'idle' || loadStatus.piecesRundownId !== rundownId) {
			dispatch(loadPieces({ rundownId }))
		}
	}, [
		loadStatus.segmentsStatus,
		loadStatus.segmentsRundownId,
		loadStatus.partsStatus,
		loadStatus.partsRundownId,
		loadStatus.piecesStatus,
		loadStatus.piecesRundownId,
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

	// Part/piece detail lives inline in the script column. Keep the outlet only for
	// rundown-level and segment-level settings (explicitly out of scope for redesign).
	const showSettingsDrawer =
		pathname === `/rundown/${rundownId}` ||
		(/^\/rundown\/[^/]+\/segment\/[^/]+\/?$/.test(pathname) && !pathname.includes('/part/'))

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

				{showSettingsDrawer ? (
					<aside className="rundown-settings-drawer" aria-label="Rundown settings">
						<MyErrorBoundary>
							<Outlet />
						</MyErrorBoundary>
					</aside>
				) : null}
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
