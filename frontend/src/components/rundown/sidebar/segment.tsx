import { useNavigate } from '@tanstack/react-router'
import { createSelector } from '@reduxjs/toolkit'
import { useAppDispatch, useAppSelector, type RootState } from '~/store/app'
import { addNewPart, movePart, reorderParts } from '~/store/parts'
import { copySegment } from '~/store/segments'
import type { Part, Segment } from '~backend/background/interfaces'
import { DragTypes } from '~/components/drag-and-drop/DragTypes'
import { DraggableContainer } from '~/components/drag-and-drop/DraggableContainer'
import { SidebarPart } from './part'
import { SidebarElementHeader } from './sidebarElementHeader'
import { useToasts } from '~/components/toasts/useToasts'
import { BsCaretDownFill, BsFillTrashFill, BsLightningCharge, BsPlus, BsTrash } from 'react-icons/bs'
import { useState } from 'react'
import { QuickStoryModal } from '../quickStoryModal'
import { Stack, type ButtonProps } from 'react-bootstrap'
import { HoverIconButton } from '~/components/rundownList/hoverIconButton'
import { SegmentButtons } from './segmentButtons'
import { DeleteSegmentButton } from '../deleteSegmentButton'
import type { Dispatch, SetStateAction } from 'react'
import { computeInsertRank } from '~/util/lib'

const selectAllParts = (state: RootState) => state.parts.parts

const selectPartsBySegmentId = createSelector(
	[selectAllParts, (_: RootState, segmentId: string) => segmentId],
	(parts, segmentId) => parts.filter((p) => p.segmentId === segmentId)
)

export function SidebarSegment({
	segment,
	isOpen,
	onToggleOpen,
	setShowImportModal,
	insertRank,
	partEdits
}: {
	segment: Segment
	isOpen: boolean
	onToggleOpen: () => void
	setShowImportModal: Dispatch<SetStateAction<number | undefined>>
	insertRank: number
	partEdits: Record<string, { displayName: string; editedAt: number }>
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()
	const [showQuickStory, setShowQuickStory] = useState(false)
	const [quickStoryRank, setQuickStoryRank] = useState<number | undefined>()

	const parts = useAppSelector((s) => selectPartsBySegmentId(s, segment.id))
	const sortedParts = [...parts].sort((a, b) => a.rank - b.rank)
	const partInsertRankById = Object.fromEntries(
		sortedParts.map((part) => [part.id, computeInsertRank(sortedParts, part.id)])
	)

	const segmentDuration = sortedParts.reduce((acc, part) => acc + (part.duration ?? 0), 0)

	const handleAddPart = (rank: number) =>
		dispatch(
			addNewPart({
				rundownId: segment.rundownId,
				playlistId: segment.playlistId,
				segmentId: segment.id,
				rank
			})
		)
			.unwrap()
			.then((part) =>
				navigate({
					to: `/rundown/${segment.rundownId}/segment/${segment.id}/part/${part.id}`
				})
			)
			.catch(() =>
				toasts.show({
					headerContent: 'Adding part',
					bodyContent: 'Encountered an unexpected error'
				})
			)

	const openQuickStory = (rank?: number) => {
		setQuickStoryRank(rank)
		setShowQuickStory(true)
	}

	const handleQuickStoryCreated = (partId: string) => {
		navigate({
			to: `/rundown/${segment.rundownId}/segment/${segment.id}/part/${partId}`
		})
	}

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
			<div className={'copy-item'}>
				<Stack direction="horizontal">
					<span
						className="segment-toggle"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							onToggleOpen()
						}}
						aria-label={isOpen ? 'Collapse segment' : 'Expand segment'}
						style={{ width: '2em', height: '2em' }}
					>
						<BsCaretDownFill />
					</span>
					<div style={{ flexGrow: 2 }}>
						<SidebarElementHeader
							label={segment.name}
							duration={segmentDuration}
							linkTo="/rundown/$rundownId/segment/$segmentId"
							linkParams={{ rundownId: segment.rundownId, segmentId: segment.id }}
							buttonClassName="segment-button copy-item text-light"
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

			<div className="ps-3 segment-content">
				{sortedParts.length > 0 ? (
					<DraggableContainer
						items={sortedParts}
						itemType={DragTypes.PART}
						id={segment.id}
						reorder={handleReorderPart}
						Component={({ data }) => (
							<SidebarPart
								part={data}
								segment={segment}
								handleAddPart={handleAddPart}
								insertRank={partInsertRankById[data.id]}
								lastEdit={partEdits[data.id]}
							/>
						)}
					/>
				) : (
					<Stack className="add-button-container gap-1">
						<button className="add-button" onClick={() => handleAddPart(0)}>
							<BsPlus className="icon-lg" aria-hidden />
							Add Part
						</button>
						<button className="add-button" onClick={() => openQuickStory(0)}>
							<BsLightningCharge className="icon-lg" aria-hidden />
							Quick Story
						</button>
					</Stack>
				)}
			</div>
			{sortedParts.length > 0 && (
				<Stack className="add-button-container px-3 pb-2">
					<button
						className="add-button"
						onClick={() => {
							const nextRank =
								sortedParts.length === 0
									? 0
									: Math.max(...sortedParts.map((p) => p.rank ?? -1)) + 1
							openQuickStory(nextRank)
						}}
					>
						<BsLightningCharge className="icon-lg" aria-hidden />
						Quick Story
					</button>
				</Stack>
			)}
			<QuickStoryModal
				show={showQuickStory}
				onClose={() => setShowQuickStory(false)}
				segment={segment}
				insertRank={quickStoryRank}
				onCreated={handleQuickStoryCreated}
			/>
			<SegmentButtons
				rundownId={segment.rundownId}
				playlistId={segment.playlistId}
				rank={insertRank}
				setShowImportModal={setShowImportModal}
			/>
		</div>
	)
}
