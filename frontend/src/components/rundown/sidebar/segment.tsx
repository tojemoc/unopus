import { useNavigate } from '@tanstack/react-router'
import { createSelector } from '@reduxjs/toolkit'
import { useAppDispatch, useAppSelector, type RootState } from '~/store/app'
import { movePart, reorderParts } from '~/store/parts'
import { copySegment } from '~/store/segments'
import type { Part, RundownReadiness, Segment } from '~backend/background/interfaces'
import { DragTypes } from '~/components/drag-and-drop/DragTypes'
import { DraggableContainer } from '~/components/drag-and-drop/DraggableContainer'
import { SidebarPartRow, StoryTableHeader } from './partRow'
import { SidebarElementHeader } from './sidebarElementHeader'
import { useToasts } from '~/components/toasts/useToasts'
import { BsCaretDownFill, BsFillTrashFill, BsTrash } from 'react-icons/bs'
import { Stack, type ButtonProps } from 'react-bootstrap'
import { HoverIconButton } from '~/components/rundownList/hoverIconButton'
import { DeleteSegmentButton } from '../deleteSegmentButton'

const selectAllParts = (state: RootState) => state.parts.parts
const selectAllPieces = (state: RootState) => state.pieces.pieces

const selectPartsBySegmentId = createSelector(
	[selectAllParts, (_: RootState, segmentId: string) => segmentId],
	(parts, segmentId) => parts.filter((p) => p.segmentId === segmentId)
)

export function SidebarSegment({
	segment,
	isOpen,
	onToggleOpen,
	readiness
}: {
	segment: Segment
	isOpen: boolean
	onToggleOpen: () => void
	readiness: RundownReadiness | null
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()

	const parts = useAppSelector((s) => selectPartsBySegmentId(s, segment.id))
	const allPieces = useAppSelector(selectAllPieces)
	const sortedParts = [...parts].sort((a, b) => a.rank - b.rank)

	const segmentDuration = sortedParts.reduce((acc, part) => acc + (part.duration ?? 0), 0)

	const handleReorderPart = (
		targetPart: Part,
		sourcePart: Part,
		sourceIndex: number,
		targetIndex: number
	) => {
		if (targetPart.segmentId !== sourcePart.segmentId) {
			return dispatch(movePart({ targetPart, sourcePart, targetIndex }))
				.unwrap()
				.then(async (newPart) => {
					await navigate({
						to: `/rundown/${segment.rundownId}/segment/${newPart.segmentId}/part/${newPart.id}`
					})
				})
				.catch((e) => {
					console.error(e)
					toasts.show({
						headerContent: 'Reordering part',
						bodyContent: 'Encountered an unexpected error'
					})
				})
		} else {
			return dispatch(reorderParts({ element: sourcePart, sourceIndex, targetIndex }))
				.unwrap()
				.then(async () => {
					await navigate({
						to: `/rundown/${segment.rundownId}/segment/${segment.id}/part/${sourcePart.id}`
					})
				})
				.catch((e) => {
					console.error(e)
					toasts.show({
						headerContent: 'Reordering part',
						bodyContent: 'Encountered an unexpected error'
					})
				})
		}
	}

	const handleCopySegment = () =>
		dispatch(copySegment({ id: segment.id, rundownId: segment.rundownId }))
			.unwrap()
			.then((newSegment) =>
				navigate({
					to: `/rundown/${newSegment.rundownId}/segment/${newSegment.id}`
				})
			)
			.catch(() =>
				toasts.show({
					headerContent: 'Adding segment',
					bodyContent: 'Encountered an unexpected error'
				})
			)

	return (
		<div className={`sidebar-segment ${isOpen ? 'open' : 'closed'}`}>
			<div className="copy-item segment-header-row">
				<Stack direction="horizontal">
					<span
						className="segment-toggle"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							onToggleOpen()
						}}
						aria-label={isOpen ? 'Collapse segment' : 'Expand segment'}
					>
						<BsCaretDownFill />
					</span>
					<div style={{ flexGrow: 2 }}>
						<SidebarElementHeader
							label={segment.name}
							duration={segmentDuration}
							linkTo="/rundown/$rundownId/segment/$segmentId"
							linkParams={{ rundownId: segment.rundownId, segmentId: segment.id }}
							buttonClassName="segment-button copy-item sidebar-item-header"
							handleCopy={handleCopySegment}
							deleteButton={
								<DeleteSegmentButton
									rundownId={segment.rundownId}
									segmentId={segment.id}
									segmentName={segment.name}
									disabled={false}
									style={{ zIndex: 4 }}
									renderButton={({ onClick, disabled }: ButtonProps) => (
										<HoverIconButton
											onClick={onClick}
											disabled={disabled}
											className="sync-plus-wrapper ms-auto"
											defaultIcon={<BsTrash className="icon-md" color="var(--bs-danger)" />}
											hoverIcon={<BsFillTrashFill className="icon-md" color="var(--bs-danger)" />}
										/>
									)}
								/>
							}
						/>
					</div>
				</Stack>
			</div>

			<div className="segment-content">
				{sortedParts.length > 0 ? (
					<div className="story-table" role="table">
						<StoryTableHeader />
						<DraggableContainer
							items={sortedParts}
							itemType={DragTypes.PART}
							id={segment.id}
							reorder={handleReorderPart}
							Component={({ data }) => (
								<SidebarPartRow
									part={data}
									readiness={readiness}
									partPieces={allPieces}
								/>
							)}
						/>
					</div>
				) : (
					<div className="story-table-empty px-2 py-2 text-muted">
						No stories yet — use the toolbar above to add one.
					</div>
				)}
			</div>
		</div>
	)
}
