import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Form, ListGroup, Spinner } from 'react-bootstrap'
import { BsGripVertical, BsPlus, BsTrash } from 'react-icons/bs'
import type { StoryTemplate } from '~backend/background/interfaces'
import {
	createStoryTemplate,
	deleteStoryTemplate,
	fetchStoryTemplates,
	updateStoryTemplate
} from '~/lib/storyApi'
import { useAppSelector } from '~/store/app'
import { useToasts } from '~/components/toasts/useToasts'

export const Route = createFileRoute('/_root/settings/story-templates')({
	component: StoryTemplatesSettings
})

function StoryTemplatesSettings() {
	const toasts = useToasts()
	const partManifests = useAppSelector((s) =>
		s.typeManifests.manifests?.filter((m) => m.entityType === 'part')
	)

	const [templates, setTemplates] = useState<StoryTemplate[]>([])
	const [loading, setLoading] = useState(true)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [name, setName] = useState('')
	const [pattern, setPattern] = useState<string[]>([])
	const [addPartType, setAddPartType] = useState('')
	const [dragIndex, setDragIndex] = useState<number | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			setTemplates(await fetchStoryTemplates())
		} catch {
			toasts.show({
				headerContent: 'Story templates',
				bodyContent: 'Could not load templates'
			})
		} finally {
			setLoading(false)
		}
	}, [toasts])

	useEffect(() => {
		load()
	}, [load])

	useEffect(() => {
		if (partManifests?.length && !addPartType) {
			setAddPartType(partManifests[0].id)
		}
	}, [partManifests, addPartType])

	const resetForm = () => {
		setEditingId(null)
		setName('')
		setPattern([])
	}

	const startEdit = (template: StoryTemplate) => {
		setEditingId(template.id)
		setName(template.name)
		setPattern([...template.pattern])
	}

	const handleSave = async () => {
		if (!name.trim() || pattern.length === 0) {
			toasts.show({
				headerContent: 'Story templates',
				bodyContent: 'Name and at least one part type are required'
			})
			return
		}
		try {
			if (editingId) {
				await updateStoryTemplate(editingId, { name: name.trim(), pattern })
			} else {
				await createStoryTemplate({ name: name.trim(), pattern })
			}
			resetForm()
			await load()
		} catch (e) {
			toasts.show({
				headerContent: 'Story templates',
				bodyContent: e instanceof Error ? e.message : 'Save failed'
			})
		}
	}

	const handleDelete = async (id: string) => {
		try {
			await deleteStoryTemplate(id)
			if (editingId === id) resetForm()
			await load()
		} catch (e) {
			toasts.show({
				headerContent: 'Story templates',
				bodyContent: e instanceof Error ? e.message : 'Delete failed'
			})
		}
	}

	const addPartToPattern = () => {
		if (!addPartType) return
		setPattern((prev) => [...prev, addPartType])
	}

	const removeFromPattern = (index: number) => {
		setPattern((prev) => prev.filter((_, i) => i !== index))
	}

	const onDragStart = (index: number) => setDragIndex(index)

	const onDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault()
		if (dragIndex === null || dragIndex === index) return
		setPattern((prev) => {
			const next = [...prev]
			const [moved] = next.splice(dragIndex, 1)
			next.splice(index, 0, moved)
			return next
		})
		setDragIndex(index)
	}

	const onDragEnd = () => setDragIndex(null)

	if (loading) {
		return (
			<div className="text-center py-4">
				<Spinner animation="border" size="sm" />
			</div>
		)
	}

	return (
		<div>
			<h2 className="h4 mb-3">Story Templates</h2>
			<p className="text-muted">
				Define reusable cue chains for Quick Story (e.g. VO → SOT → VO).
			</p>

			<Card className="mb-4 bg-dark text-light border-secondary">
				<Card.Body>
					<Form.Group className="mb-3">
						<Form.Label>Template name</Form.Label>
						<Form.Control
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Standard VO/SOT"
						/>
					</Form.Group>

					<Form.Label>Cue chain (drag to reorder)</Form.Label>
					{pattern.length === 0 ? (
						<Alert variant="secondary" className="small py-2">
							Add part types below to build the pattern.
						</Alert>
					) : (
						<ListGroup className="mb-3">
							{pattern.map((partTypeId, index) => {
								const manifest = partManifests?.find((m) => m.id === partTypeId)
								return (
									<ListGroup.Item
										key={`${partTypeId}-${index}`}
										className="d-flex align-items-center gap-2 bg-dark text-light border-secondary"
										draggable
										onDragStart={() => onDragStart(index)}
										onDragOver={(e) => onDragOver(e, index)}
										onDragEnd={onDragEnd}
									>
										<BsGripVertical className="text-muted" aria-hidden />
										<span
											className="badge rounded-pill"
											style={{ backgroundColor: manifest?.colour ?? '#666' }}
										>
											{manifest?.shortName ?? partTypeId}
										</span>
										<Button
											size="sm"
											variant="outline-danger"
											className="ms-auto"
											onClick={() => removeFromPattern(index)}
											aria-label="Remove"
										>
											<BsTrash />
										</Button>
									</ListGroup.Item>
								)
							})}
						</ListGroup>
					)}

					<div className="d-flex gap-2 mb-3">
						<Form.Select
							value={addPartType}
							onChange={(e) => setAddPartType(e.target.value)}
							aria-label="Part type to add"
							style={{ maxWidth: 240 }}
						>
							{partManifests?.map((m) => (
								<option key={m.id} value={m.id}>
									{m.name} ({m.shortName})
								</option>
							))}
						</Form.Select>
						<Button variant="outline-light" onClick={addPartToPattern}>
							<BsPlus className="me-1" aria-hidden />
							Add cue
						</Button>
					</div>

					<div className="d-flex gap-2">
						<Button variant="primary" onClick={handleSave}>
							{editingId ? 'Update template' : 'Create template'}
						</Button>
						{editingId && (
							<Button variant="secondary" onClick={resetForm}>
								Cancel edit
							</Button>
						)}
					</div>
				</Card.Body>
			</Card>

			<h3 className="h5 mb-3">Saved templates</h3>
			{templates.length === 0 ? (
				<p className="text-muted">No templates yet.</p>
			) : (
				<ListGroup>
					{templates.map((t) => (
						<ListGroup.Item
							key={t.id}
							className="d-flex justify-content-between align-items-center bg-dark text-light border-secondary"
						>
							<div>
								<div className="fw-semibold">{t.name}</div>
								<div className="small text-muted">
									{t.pattern
										.map((id) => partManifests?.find((m) => m.id === id)?.shortName ?? id)
										.join(' → ')}
								</div>
							</div>
							<div className="d-flex gap-2">
								<Button size="sm" variant="outline-light" onClick={() => startEdit(t)}>
									Edit
								</Button>
								<Button size="sm" variant="outline-danger" onClick={() => handleDelete(t.id)}>
									Delete
								</Button>
							</div>
						</ListGroup.Item>
					))}
				</ListGroup>
			)}
		</div>
	)
}
