import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Form, Offcanvas, OverlayTrigger, Popover, Spinner } from 'react-bootstrap'
import { BsArrowReturnLeft } from 'react-icons/bs'
import { useNavigate } from '@tanstack/react-router'
import type { Segment, StoryLibraryEntry } from '~backend/background/interfaces'
import { useAppDispatch, useAppSelector } from '~/store/app'
import {
	searchStoryLibrary,
	setStoryLibraryOpen,
	setStoryLibraryQuery
} from '~/store/storyLibrary'
import { ipcAPI } from '~/lib/IPC'
import { pushPart } from '~/store/parts'
import { pushPiece } from '~/store/pieces'
import { useToasts } from '~/components/toasts/useToasts'
import './storyLibraryDrawer.scss'

function formatRundownDate(timestamp?: number): string {
	if (!timestamp) return ''
	return new Date(timestamp).toLocaleDateString()
}

function RecallPopover({
	entry,
	segments,
	onRecalled
}: {
	entry: StoryLibraryEntry
	segments: Segment[]
	onRecalled: (partId: string, segmentId: string) => void
}) {
	const toasts = useToasts()
	const dispatch = useAppDispatch()
	const [targetSegmentId, setTargetSegmentId] = useState(segments[0]?.id ?? '')
	const [submitting, setSubmitting] = useState(false)

	const handleRecall = async () => {
		if (!targetSegmentId) return
		setSubmitting(true)
		try {
			const { part, pieces } = await ipcAPI.recallStory(entry.id, {
				targetSegmentId
			})
			dispatch(pushPart(part))
			dispatch(pushPiece(pieces))
			onRecalled(part.id, targetSegmentId)
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Recall story',
				bodyContent: e instanceof Error ? e.message : 'Recall failed'
			})
		} finally {
			setSubmitting(false)
		}
	}

	const popover = (
		<Popover id={`recall-${entry.id}`} className="story-library-recall-popover">
			<Popover.Header as="h3">Insert where?</Popover.Header>
			<Popover.Body>
				<Form.Group className="mb-3">
					<Form.Label className="small">Segment</Form.Label>
					<Form.Select
						size="sm"
						value={targetSegmentId}
						onChange={(e) => setTargetSegmentId(e.target.value)}
						aria-label="Target segment"
					>
						{segments.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name}
							</option>
						))}
					</Form.Select>
				</Form.Group>
				<Button
					size="sm"
					variant="primary"
					disabled={!targetSegmentId || submitting}
					onClick={handleRecall}
				>
					{submitting ? 'Inserting…' : 'Confirm'}
				</Button>
			</Popover.Body>
		</Popover>
	)

	return (
		<OverlayTrigger trigger="click" placement="left" rootClose overlay={popover}>
			<Button size="sm" variant="outline-light" className="d-inline-flex align-items-center gap-1">
				<BsArrowReturnLeft aria-hidden />
				Recall
			</Button>
		</OverlayTrigger>
	)
}

export function StoryLibraryDrawer({ rundownId }: { rundownId: string }) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const isOpen = useAppSelector((s) => s.storyLibrary.isOpen)
	const searchQuery = useAppSelector((s) => s.storyLibrary.searchQuery)
	const searchResults = useAppSelector((s) => s.storyLibrary.searchResults)
	const searchStatus = useAppSelector((s) => s.storyLibrary.searchStatus)

	const partManifests = useAppSelector((s) =>
		s.typeManifests.manifests?.filter((m) => m.entityType === 'part')
	)
	const segments = useAppSelector((s) =>
		s.segments.segments.filter((seg) => seg.rundownId === rundownId).sort((a, b) => a.rank - b.rank)
	)

	const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedQuery(searchQuery), 300)
		return () => window.clearTimeout(timer)
	}, [searchQuery])

	useEffect(() => {
		if (!isOpen) return
		dispatch(searchStoryLibrary(debouncedQuery))
	}, [debouncedQuery, isOpen, dispatch])

	const handleClose = () => dispatch(setStoryLibraryOpen(false))

	const handleRecalled = useCallback(
		(partId: string, segmentId: string) => {
			dispatch(setStoryLibraryOpen(false))
			navigate({
				to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
				params: { rundownId, segmentId, partId }
			})
		},
		[dispatch, navigate, rundownId]
	)

	const resultsById = useMemo(() => searchResults, [searchResults])

	return (
		<Offcanvas
			show={isOpen}
			onHide={handleClose}
			placement="end"
			backdrop={false}
			scroll
			className="story-library-drawer text-bg-dark"
		>
			<Offcanvas.Header closeButton closeVariant="white">
				<Offcanvas.Title>Story Library</Offcanvas.Title>
			</Offcanvas.Header>
			<Offcanvas.Body>
				<Form.Control
					type="search"
					placeholder="Search stories…"
					value={searchQuery}
					onChange={(e) => dispatch(setStoryLibraryQuery(e.target.value))}
					className="mb-3"
					aria-label="Search story library"
				/>
				{searchStatus === 'pending' && (
					<div className="text-center py-3">
						<Spinner animation="border" size="sm" />
					</div>
				)}
				{searchStatus !== 'pending' && resultsById.length === 0 && (
					<p className="text-muted small">No stories found.</p>
				)}
				<ul className="list-unstyled story-library-results mb-0">
					{resultsById.map((entry) => {
						const manifest = partManifests?.find((m) => m.id === entry.partType)
						return (
							<li key={entry.id} className="story-library-item mb-3 p-2 rounded">
								<div className="d-flex justify-content-between align-items-start gap-2 mb-1">
									<div>
										<div className="fw-semibold">{entry.name || 'Untitled'}</div>
										<span
											className="badge rounded-pill"
											style={{
												backgroundColor: manifest?.colour ?? '#666',
												fontSize: '0.7rem'
											}}
										>
											{manifest?.shortName ?? entry.partType}
										</span>
									</div>
									<RecallPopover
										entry={entry}
										segments={segments}
										onRecalled={handleRecalled}
									/>
								</div>
								<div className="small text-muted">
									{entry.rundownName}
									{entry.rundownDate ? ` · ${formatRundownDate(entry.rundownDate)}` : ''}
								</div>
								{entry.script && (
									<div className="story-library-script small text-secondary mt-1">
										{entry.script}
									</div>
								)}
							</li>
						)
					})}
				</ul>
			</Offcanvas.Body>
		</Offcanvas>
	)
}
