import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { Link } from '@tanstack/react-router'
import type { Rundown, Segment } from '~backend/background/interfaces'
import { ipcAPI } from '~/lib/IPC'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { pushPart } from '~/store/parts'
import { pushPiece } from '~/store/pieces'
import { useToasts } from '~/components/toasts/useToasts'
import { pickTemplateSourceSegmentId } from '~/util/templateSourceSegment'

const modalSurface = { backgroundColor: '#1a1d20ff' }

interface QuickStoryModalProps {
	show: boolean
	onClose: () => void
	segment: Segment
	insertRank?: number
	onCreated?: (partId: string) => void
}

export function QuickStoryModal({
	show,
	onClose,
	segment,
	insertRank,
	onCreated
}: QuickStoryModalProps) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const templateRundowns = useAppSelector((s) => s.rundowns.filter((r) => r.isTemplate))
	const partManifests = useAppSelector((s) =>
		s.typeManifests.manifests?.filter((m) => m.entityType === 'part')
	)

	const [selectedId, setSelectedId] = useState<string>('')
	const [submitting, setSubmitting] = useState(false)
	const prevShowRef = useRef(false)

	useEffect(() => {
		const justOpened = show && !prevShowRef.current
		prevShowRef.current = show
		if (!show) {
			return
		}
		setSelectedId((current) => {
			if (!justOpened && current && templateRundowns.some((t) => t.id === current)) {
				return current
			}
			return templateRundowns[0]?.id ?? ''
		})
	}, [show, templateRundowns])

	const templateParts = useAppSelector((s) => {
		if (!selectedId) return []
		const sourceSegmentId = pickTemplateSourceSegmentId(
			selectedId,
			s.segments.segments,
			s.parts.parts
		)
		if (!sourceSegmentId) return []
		return s.parts.parts
			.filter((p) => p.rundownId === selectedId && p.segmentId === sourceSegmentId)
			.sort((a, b) => a.rank - b.rank)
	})

	const previewFromStore = useMemo(() => {
		return templateParts.map((part, index) => {
			const manifest = partManifests?.find((m) => m.id === part.partType)
			return {
				key: `${part.id}-${index}`,
				label: part.name || manifest?.shortName || part.partType,
				colour: manifest?.colour ?? '#666'
			}
		})
	}, [templateParts, partManifests])

	const handleCreate = async () => {
		if (!selectedId) return
		setSubmitting(true)
		try {
			const result = await ipcAPI.quickAddStory(segment.id, {
				templateRundownId: selectedId,
				rank: insertRank
			})
			dispatch(pushPart(result.parts))
			dispatch(pushPiece(result.pieces))
			const firstPart = result.parts[0]
			if (firstPart) {
				onCreated?.(firstPart.id)
			}
			onClose()
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Quick Story',
				bodyContent: e instanceof Error ? e.message : 'Could not create story'
			})
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<Modal show={show} onHide={onClose} size="lg">
			<Modal.Header closeButton style={modalSurface}>
				<Modal.Title>Quick Story</Modal.Title>
			</Modal.Header>
			<Modal.Body style={modalSurface}>
				{templateRundowns.length === 0 ? (
					<p className="text-muted mb-0">
						No templates yet.{' '}
						<Link to="/" onClick={onClose}>
							Import or create one under Rundowns → Templates
						</Link>
						.
					</p>
				) : (
					<>
						<Form.Group className="mb-3">
							<Form.Label>Rundown template</Form.Label>
							<Form.Select
								value={selectedId}
								onChange={(e) => setSelectedId(e.target.value)}
								aria-label="Rundown template"
							>
								{templateRundowns.map((t: Rundown) => (
									<option key={t.id} value={t.id}>
										{t.name}
									</option>
								))}
							</Form.Select>
						</Form.Group>
						{previewFromStore.length > 0 && (
							<div className="mb-2">
								<Form.Label className="text-muted small">Parts copied from template</Form.Label>
								<div className="d-flex flex-wrap align-items-center gap-1">
									{previewFromStore.map((pill, i) => (
										<span key={pill.key} className="d-inline-flex align-items-center gap-1">
											{i > 0 && <span className="text-muted small">→</span>}
											<span
												className="badge rounded-pill"
												style={{
													backgroundColor: pill.colour,
													color: '#fff',
													fontSize: '0.75rem'
												}}
											>
												{pill.label}
											</span>
										</span>
									))}
								</div>
							</div>
						)}
					</>
				)}
			</Modal.Body>
			<Modal.Footer style={modalSurface} className="d-flex justify-content-between">
				<Link to="/" className="small" onClick={onClose}>
					Manage templates
				</Link>
				<div className="d-flex gap-2">
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						disabled={!selectedId || submitting || templateRundowns.length === 0}
						onClick={handleCreate}
					>
						{submitting ? 'Creating…' : 'Create'}
					</Button>
				</div>
			</Modal.Footer>
		</Modal>
	)
}
