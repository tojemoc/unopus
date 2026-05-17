import { useEffect, useMemo, useState } from 'react'
import { Button, Form, Modal, Spinner } from 'react-bootstrap'
import { Link } from '@tanstack/react-router'
import type { Segment, StoryTemplate } from '~backend/background/interfaces'
import { fetchStoryTemplates } from '~/lib/storyApi'
import { ipcAPI } from '~/lib/IPC'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { pushPart } from '~/store/parts'
import { pushPiece } from '~/store/pieces'
import { useToasts } from '~/components/toasts/useToasts'

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
	const partManifests = useAppSelector((s) =>
		s.typeManifests.manifests?.filter((m) => m.entityType === 'part')
	)

	const [templates, setTemplates] = useState<StoryTemplate[]>([])
	const [loadingTemplates, setLoadingTemplates] = useState(false)
	const [selectedId, setSelectedId] = useState<string>('')
	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		if (!show) return
		setLoadingTemplates(true)
		fetchStoryTemplates()
			.then((list) => {
				setTemplates(list)
				setSelectedId(list[0]?.id ?? '')
			})
			.catch(() => {
				toasts.show({
					headerContent: 'Story templates',
					bodyContent: 'Could not load templates'
				})
			})
			.finally(() => setLoadingTemplates(false))
	}, [show, toasts])

	const selected = templates.find((t) => t.id === selectedId)

	const previewPills = useMemo(() => {
		if (!selected?.pattern.length) return []
		return selected.pattern.map((partTypeId, index) => {
			const manifest = partManifests?.find((m) => m.id === partTypeId)
			return {
				key: `${partTypeId}-${index}`,
				label: manifest?.shortName ?? partTypeId,
				colour: manifest?.colour ?? '#666'
			}
		})
	}, [selected, partManifests])

	const handleCreate = async () => {
		if (!selectedId) return
		setSubmitting(true)
		try {
			const result = await ipcAPI.quickAddStory(segment.id, {
				storyTemplateId: selectedId,
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
				{loadingTemplates ? (
					<div className="text-center py-4">
						<Spinner animation="border" size="sm" />
					</div>
				) : templates.length === 0 ? (
					<p className="text-muted mb-0">
						No story templates yet.{' '}
						<Link to="/settings/story-templates">Create one in Settings</Link>.
					</p>
				) : (
					<>
						<Form.Group className="mb-3">
							<Form.Label>Story template</Form.Label>
							<Form.Select
								value={selectedId}
								onChange={(e) => setSelectedId(e.target.value)}
								aria-label="Story template"
							>
								{templates.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name}
									</option>
								))}
							</Form.Select>
						</Form.Group>
						{previewPills.length > 0 && (
							<div className="mb-2">
								<Form.Label className="text-muted small">Cue chain</Form.Label>
								<div className="d-flex flex-wrap align-items-center gap-1">
									{previewPills.map((pill, i) => (
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
				<Link to="/settings/story-templates" className="small" onClick={onClose}>
					Manage Templates
				</Link>
				<div className="d-flex gap-2">
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						disabled={!selectedId || submitting || templates.length === 0}
						onClick={handleCreate}
					>
						{submitting ? 'Creating…' : 'Create'}
					</Button>
				</div>
			</Modal.Footer>
		</Modal>
	)
}
