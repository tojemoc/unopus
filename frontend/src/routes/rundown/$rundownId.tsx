import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Stack } from 'react-bootstrap'
import { DuopusNavbar } from '~/components/navbar/duopusNavbar'
import { RundownNavbar } from '~/components/rundown/navbar'
import { RundownSidebar } from '~/components/rundown/sidebar'
import { StoryLibraryDrawer } from '~/components/rundown/storyLibrary/storyLibraryDrawer'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { loadParts } from '~/store/parts'
import { loadPieces } from '~/store/pieces'
import { loadSegments } from '~/store/segments'
import { MyErrorBoundary } from '~/util/errorBoundary'

export const Route = createFileRoute('/rundown/$rundownId')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId } = Route.useParams()

	const dispatch = useAppDispatch()
	const loadStatus = useAppSelector((state) => ({
		segmentsStatus: state.segments.status,
		segmentsRundownId: state.segments.rundownId,
		partsStatus: state.parts.status,
		partsRundownId: state.parts.rundownId,
		piecesStatus: state.pieces.status,
		piecesRundownId: state.pieces.rundownId
	}))

	// TODO: This is not the correct way to do this, but it works for now
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
		// Note: this can't redirect, or it gets stuck in a loop
		return (
			<>
				<DuopusNavbar />
				<div>Rundown not found</div>
			</>
		)
	}

	return (
		<div style={rootStyle}>
			<DuopusNavbar rundownName={rundown.name} />
			<RundownNavbar rundown={rundown} />

			<Stack
				direction="horizontal"
				style={{
					height: '100%',
					overflowX: 'hidden'
				}}
			>
				<RundownSidebar rundownId={rundown.id} playlistId={rundown.playlistId} />

				<MyErrorBoundary>
					<Outlet />
				</MyErrorBoundary>
			</Stack>
			<StoryLibraryDrawer rundownId={rundown.id} />
		</div>
	)
}

const rootStyle: React.CSSProperties = {
	display: 'grid',
	height: '100%',
	gridTemplateRows: 'auto 1fr auto',
	overflowX: 'hidden'
}
