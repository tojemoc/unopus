import { useNavigate, useRouterState } from '@tanstack/react-router'
import { createSelector } from '@reduxjs/toolkit'
import { useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector, type RootState } from '~/store/app'
import { movePart, reorderParts } from '~/store/parts'
import { copySegment, updateSegment } from '~/store/segments'
import type { Part, Segment } from '~backend/background/interfaces'
import { DragTypes } from '~/components/drag-and-drop/DragTypes'
import { DraggableContainer } from '~/components/drag-and-drop/DraggableContainer'
import type { DraggableWrappedComponent } from '~/components/drag-and-drop/DraggableComponentWrapper'
import { SidebarPartRow } from './partRow'
import { SidebarElementHeader } from './sidebarElementHeader'
import { useToasts } from '~/components/toasts/useToasts'
import { BsFillTrashFill, BsTrash } from 'react-icons/bs'
import { IconSegment } from '~/components/icons/broadcastIcons'
import { Stack, type ButtonProps } from 'react-bootstrap'
import { HoverIconButton } from '~/components/rundownList/hoverIconButton'
import { DeleteSegmentButton } from '../deleteSegmentButton'
import { PartTypeButtons } from './partTypeButtons'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { usePartInsertTarget } from '~/hooks/usePartInsertTarget'
import { matchesStoryFilter, useStoryFilter } from '~/hooks/StoryFilterContext'
import { computeInsertRank } from '~/util/lib'
import { resolvePartOnAirDuration } from '~/util/pieceDuration'
import { resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { canEditRundown } from '~/util/roles'

const selectAllParts = (state: RootState) => state.parts.parts
const selectAllPieces = (state: RootState) => state.pieces.pieces

const selectPartsBySegmentId = createSelector(
	[selectAllParts, (_: RootState, segmentId: string) => segmentId],
	(parts, segmentId) => parts.filter((p) => p.segmentId === segmentId)
)

/** Stable DnD row type — expand/readiness must not change this identity. */
const PartRowComponent: DraggableWrappedComponent<Part> = ({ data }) => <SidebarPartRow part={data} />

export function SidebarSegment({ segment }: { segment: Segment }) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()
	const [isOpen, setIsOpen] = useState(true)
	const { expandedPartId } = useScriptExpand()
	const insertTarget = usePartInsertTarget(segment.rundownId)

	// Route segment is the insert target for part pills — highlight it so
	// editors can see which story they're adding into (Link.active no longer applies
	// after click-to-select / double-click-rename replaced the segment Link).
	const isSelectedSegment = useRouterState({
		select: (s) => {
			const match = s.matches.find((m) => m.fullPath.includes('/segment/$segmentId'))
			const params = match?.params as Record<string, string | undefined> | undefined
			return (
				params?.rundownId === segment.rundownId && params?.segmentId === segment.id
			)
		}
	})

	const parts = useAppSelector((s) => selectPartsBySegmentId(s, segment.id))
	const isOnAirSegment = useAppSelector(
		(s) => s.playout.byRundownId[segment.rundownId]?.currentSegmentId === segment.id
	)
	const allPieces = useAppSelector(selectAllPieces)
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const settings = useAppSelector((s) => s.settings.settings)
	const scriptCps = resolveEffectiveScriptCps({
		userScriptCps,
		settingsCps: settings?.scriptCps
	})
	const durationOpts = {
		scriptCps,
		defaultDurationMode: settings?.iluDurationMode ?? ('auto' as const)
	}
	const sortedParts = useMemo(() => [...parts].sort((a, b) => a.rank - b.rank), [parts])
	const storyFilter = useStoryFilter()
	const visibleParts = useMemo(
		() =>
			sortedParts.filter((part) => matchesStoryFilter(storyFilter, part.name, part.script)),
		[sortedParts, storyFilter]
	)
	const hideForFilter = Boolean(storyFilter.trim()) && visibleParts.length === 0

	const segmentDuration = sortedParts.reduce((acc, part) => {
		const partPieces = allPieces
			.filter((piece) => piece.partId === part.id)
			.map((piece) => ({
				pieceType: piece.pieceType,
				duration: piece.duration,
				skip: piece.skip
			}))
		return acc + (resolvePartOnAirDuration(part, partPieces, durationOpts) ?? 0)
	}, 0)

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

	const handleRenameSegment = async (name: string) => {
		try {
			await dispatch(updateSegment({ segment: { ...segment, name } })).unwrap()
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Renaming segment',
				bodyContent: 'Encountered an unexpected error'
			})
			throw e
		}
	}

	const userRole = useAppSelector((s) => s.auth.user?.role)
	const canEdit = canEditRundown(userRole)

	// Show add-part chips on the active segment: route selection and/or expanded story.
	// Expanding a story does not always update the segment route, so fall back to local rank.
	const localInsertTarget = useMemo(() => {
		if (!canEdit) return null

		if (insertTarget?.segment.id === segment.id) {
			return insertTarget
		}

		const expandedPart = expandedPartId
			? sortedParts.find((part) => part.id === expandedPartId)
			: undefined
		if (expandedPart) {
			return {
				segment,
				rank: computeInsertRank(sortedParts, expandedPart.id),
				hint: `after "${expandedPart.name}"`
			}
		}

		if (isSelectedSegment) {
			if (sortedParts.length === 0) {
				return { segment, rank: 0, hint: `in "${segment.name}"` }
			}
			const lastPart = sortedParts[sortedParts.length - 1]
			return {
				segment,
				rank: computeInsertRank(sortedParts, lastPart.id),
				hint: `at end of "${segment.name}"`
			}
		}

		return null
	}, [canEdit, insertTarget, segment, sortedParts, expandedPartId, isSelectedSegment])

	if (hideForFilter) {
		return null
	}

	const storyCount = storyFilter.trim() ? visibleParts.length : sortedParts.length

	return (
		<div
			className={`sidebar-segment ${isOpen ? 'open' : 'closed'}${isOnAirSegment ? ' sidebar-segment--on-air' : ''}${isSelectedSegment ? ' sidebar-segment--selected' : ''}`}
			aria-current={isSelectedSegment ? 'true' : undefined}
		>
			<div className="copy-item segment-header-row">
				<Stack direction="horizontal" className="segment-header-row__inner">
					<span
						className="segment-toggle"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							setIsOpen((open) => !open)
						}}
						aria-label={isOpen ? 'Collapse segment' : 'Expand segment'}
					>
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
							<path
								d="M4 6.5 8 10.5 12 6.5"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</span>
					<div style={{ flexGrow: 2, minWidth: 0 }}>
						<SidebarElementHeader
							label={
								<span className="segment-header__label">
									<span className="segment-header__mark" aria-hidden>
										<IconSegment size={13} />
									</span>
									<span className="segment-header__name">{segment.name}</span>
									<span className="segment-header__count">{storyCount}</span>
								</span>
							}
							renameValue={segment.name}
							onRename={canEdit ? handleRenameSegment : undefined}
							onSelect={() => {
								void navigate({
									to: `/rundown/${segment.rundownId}/segment/${segment.id}`
								})
							}}
							selected={isSelectedSegment}
							duration={segmentDuration}
							buttonClassName="segment-button copy-item sidebar-item-header"
							handleCopy={canEdit ? handleCopySegment : undefined}
							deleteButton={
								canEdit ? (
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
								) : null
							}
						/>
					</div>
				</Stack>
			</div>

			{localInsertTarget ? (
				<div
					className="segment-part-type-bar"
					aria-label={`Add story ${localInsertTarget.hint}`}
				>
					<PartTypeButtons
						segment={localInsertTarget.segment}
						rank={localInsertTarget.rank}
						insertHint={localInsertTarget.hint}
					/>
				</div>
			) : null}

			{isOpen ? (
				<div className="segment-content">
					{sortedParts.length > 0 ? (
						<DraggableContainer
							items={sortedParts}
							itemType={DragTypes.PART}
							id={segment.id}
							reorder={handleReorderPart}
							Component={PartRowComponent}
							canDragItem={(part) => canEdit && expandedPartId !== part.id}
						/>
					) : (
						<div className="story-table-empty px-2 py-2 text-muted">
							{canEdit
								? 'No stories yet — use the buttons above to add one.'
								: 'No stories yet.'}
						</div>
					)}
				</div>
			) : null}
		</div>
	)
}
