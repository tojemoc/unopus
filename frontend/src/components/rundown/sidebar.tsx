import { useNavigate } from '@tanstack/react-router'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { reorderSegments } from '~/store/segments'
import type { Segment } from '~backend/background/interfaces'
import './sidebar.scss'
import { DragTypes } from '~/components/drag-and-drop/DragTypes'
import { DraggableContainer } from '../drag-and-drop/DraggableContainer'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ImportSegmentModal from './importSegmentModal/importSegmentModal'
import { SidebarSegment } from './sidebar/segment'
import { StoryTableHeader } from './sidebar/partRow'
import { useToasts } from '../toasts/useToasts'
import { SegmentButtons } from './sidebar/segmentButtons'
import { useRundownReadinessContext } from '~/hooks/RundownReadinessContext'

export function RundownSidebar({
	rundownId,
	playlistId
}: {
	rundownId: string
	playlistId: string | null
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()
	const [showImportModal, setShowImportModal] = useState<number | undefined>(undefined)

	const segments = useAppSelector((state) => state.segments.segments)
	const sortedSegments = useMemo(
		() => [...segments].sort((a, b) => a.rank - b.rank),
		[segments]
	)

	const { readiness, loading, error, refresh } = useRundownReadinessContext()

	const [openSegments, setOpenSegments] = useState<Record<string, boolean>>({})

	useEffect(() => {
		setOpenSegments((prev) => {
			let changed = false
			const next = { ...prev }
			for (const segment of sortedSegments) {
				if (next[segment.id] === undefined) {
					next[segment.id] = true
					changed = true
				}
			}
			return changed ? next : prev
		})
	}, [sortedSegments])

	const isSegmentOpen = useCallback(
		(segmentId: string) => openSegments[segmentId] ?? true,
		[openSegments]
	)

	const toggleSegmentOpen = useCallback((segmentId: string) => {
		setOpenSegments((prev) => ({
			...prev,
			[segmentId]: !(prev[segmentId] ?? true)
		}))
	}, [])

	const handleReorderSegment = (
		_targetSegment: Segment,
		sourceSegment: Segment,
		sourceIndex: number,
		targetIndex: number
	) => {
		return dispatch(reorderSegments({ element: sourceSegment, sourceIndex, targetIndex }))
			.unwrap()
			.then(async () => {
				await navigate({
					to: `/rundown/${sourceSegment.rundownId}/segment/${sourceSegment.id}`
				})
			})
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Reordering Segment',
					bodyContent: 'Encountered an unexpected error'
				})
			})
	}

	const readyCount = readiness?.summary.readyMediaPieces ?? 0
	const totalCount = readiness?.summary.totalMediaPieces ?? 0
	const summaryText = error
		? 'Readiness check failed'
		: loading
			? 'Checking media…'
			: `${readyCount}/${totalCount} media items ready`

	return (
		<div className="rundown-sidebar">
			<div className="rundown-sidebar-toolbar">
				<span className="rundown-sidebar-toolbar__title">Stories</span>
				<span className="rundown-sidebar-toolbar__summary" title={error ?? undefined}>
					{summaryText}
				</span>
				<button type="button" className="rundown-sidebar-toolbar__refresh" onClick={() => void refresh()}>
					Refresh
				</button>
			</div>

			<div className="rundown-sidebar-scroll">
				<div className="story-table story-table--sidebar">
					<StoryTableHeader />
					<DraggableContainer
						items={sortedSegments}
						itemType={DragTypes.SEGMENT}
						Component={({ data: segment }) => (
							<SidebarSegment
								key={segment.id}
								segment={segment}
								isOpen={isSegmentOpen(segment.id)}
								onToggleOpen={() => toggleSegmentOpen(segment.id)}
								readiness={readiness}
							/>
						)}
						id={rundownId}
						reorder={handleReorderSegment}
					/>
				</div>

				<SegmentButtons
					rundownId={rundownId}
					playlistId={playlistId}
					rank={sortedSegments.length}
					setShowImportModal={setShowImportModal}
				/>

				<ImportSegmentModal
					rank={showImportModal}
					onClose={() => setShowImportModal(undefined)}
					targetRundownId={rundownId}
				/>
			</div>
		</div>
	)
}
