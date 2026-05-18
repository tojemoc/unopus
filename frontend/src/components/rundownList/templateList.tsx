import { useState } from 'react'
import { Button, Card, Col, Form, Modal, Row } from 'react-bootstrap'
import { Link } from '@tanstack/react-router'
import { BsBoxArrowInUp, BsBoxArrowUp } from 'react-icons/bs'
import type { Rundown, SerializedRundown } from '~backend/background/interfaces'
import { useAppDispatch, useAppSelector, useAppStore } from '~/store/app'
import { ipcAPI } from '~/lib/IPC'
import { regenerateFromTemplate, reconcileTemplateSchedule } from '~/lib/rundownScheduleApi'
import { updateRundown, pushRundown, initRundowns } from '~/store/rundowns'
import { useToasts } from '~/components/toasts/useToasts'

interface TemplateListProps {
	templates: Rundown[]
	onImportTemplate: () => void
}

export function TemplateList({ templates, onImportTemplate }: TemplateListProps) {
	const dispatch = useAppDispatch()
	const store = useAppStore()
	const toasts = useToasts()
	const settings = useAppSelector((s) => s.settings.settings)
	const [regenerateTarget, setRegenerateTarget] = useState<Rundown | null>(null)
	const [busyId, setBusyId] = useState<string | null>(null)

	if (templates.length === 0) {
		return (
			<div className="rundown-empty-state">
				<p>No templates yet. Create one or import a rundown template to get started.</p>
			</div>
		)
	}

	const saveTemplateSchedule = async (
		template: Rundown,
		patch: Partial<
			Pick<Rundown, 'scheduleEnabled' | 'scheduleAheadCount' | 'scheduleStartTime'>
		>
	) => {
		try {
			const updated = await dispatch(
				updateRundown({ rundown: { ...template, ...patch } })
			).unwrap()
			if (patch.scheduleEnabled) {
				const created = await reconcileTemplateSchedule(updated.id)
				for (const r of created) {
					dispatch(pushRundown(r))
				}
			}
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Template schedule',
				bodyContent: 'Could not save schedule settings'
			})
		}
	}

	const exportTemplate = (template: Rundown) => {
		const state = store.getState()
		const serialized: SerializedRundown = {
			rundown: state.rundowns.find((r) => r.id === template.id) as Rundown,
			segments: state.segments.segments.filter((s) => s.rundownId === template.id),
			parts: state.parts.parts.filter((p) => p.rundownId === template.id),
			pieces: state.pieces.pieces.filter((p) => p.rundownId === template.id)
		}
		if (!serialized.rundown) {
			return
		}
		ipcAPI
			.saveToFile({
				title: 'Export template',
				document: serialized
			})
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Export template',
					bodyContent: 'Export failed'
				})
			})
	}

	const confirmRegenerate = async () => {
		if (!regenerateTarget) {
			return
		}
		setBusyId(regenerateTarget.id)
		try {
			const summary = await regenerateFromTemplate(regenerateTarget.id)
			toasts.show({
				headerContent: 'Regenerate rundowns',
				bodyContent: `Created ${summary.created}, updated ${summary.updated}, skipped ${summary.skippedModified} modified, ${summary.skippedPast} past.`
			})
			const fresh = await ipcAPI.getRundowns()
			if (Array.isArray(fresh)) {
				dispatch(initRundowns(fresh))
			}
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Regenerate rundowns',
				bodyContent: e instanceof Error ? e.message : 'Regeneration failed'
			})
		} finally {
			setBusyId(null)
			setRegenerateTarget(null)
		}
	}

	const defaultAhead = settings?.scheduleAheadCount ?? 5
	const defaultStart = settings?.scheduleStartTime ?? '18:00'

	return (
		<>
			<Row xs={1} lg={2} className="g-3">
				{templates.map((template) => (
					<Col key={template.id}>
						<Card className="rundown-card h-100">
							<Card.Body>
								<Card.Title>{template.name}</Card.Title>
								<Card.Text className="text-muted small">
									Revision {template.templateRevision ?? 0}
									{template.scheduleEnabled
										? ' · Auto-schedule on'
										: ' · Auto-schedule off'}
								</Card.Text>

								<Form.Check
									type="switch"
									id={`schedule-${template.id}`}
									className="mb-2"
									label="Auto-schedule weekday rundowns"
									checked={template.scheduleEnabled === true}
									onChange={(e) =>
										void saveTemplateSchedule(template, {
											scheduleEnabled: e.target.checked
										})
									}
								/>

								<Row className="g-2 mb-3">
									<Col xs={6}>
										<Form.Label className="small mb-0">Ahead count</Form.Label>
										<Form.Control
											size="sm"
											type="number"
											min={1}
											max={30}
											placeholder={String(defaultAhead)}
											value={template.scheduleAheadCount ?? ''}
											onChange={(e) => {
												const v = e.target.value
												void saveTemplateSchedule(template, {
													scheduleAheadCount: v ? Number(v) : undefined
												})
											}}
										/>
									</Col>
									<Col xs={6}>
										<Form.Label className="small mb-0">Start time</Form.Label>
										<Form.Control
											size="sm"
											type="time"
											value={template.scheduleStartTime ?? defaultStart}
											onChange={(e) =>
												void saveTemplateSchedule(template, {
													scheduleStartTime: e.target.value
												})
											}
										/>
									</Col>
								</Row>

								<div className="d-flex flex-wrap gap-2">
									<Link
										to="/rundown/$rundownId"
										params={{ rundownId: template.id }}
										className="btn btn-primary btn-sm"
									>
										Edit template
									</Link>
									<Button
										size="sm"
										variant="outline-secondary"
										className="d-inline-flex align-items-center gap-1"
										onClick={() => exportTemplate(template)}
									>
										<BsBoxArrowUp aria-hidden />
										Export
									</Button>
									<Button
										size="sm"
										variant="outline-warning"
										disabled={busyId === template.id}
										onClick={() => setRegenerateTarget(template)}
									>
										Regenerate from template
									</Button>
								</div>
							</Card.Body>
						</Card>
					</Col>
				))}
			</Row>

			<div className="mt-3">
				<Button
					variant="outline-primary"
					size="sm"
					className="d-inline-flex align-items-center gap-2"
					onClick={onImportTemplate}
				>
					<BsBoxArrowInUp aria-hidden />
					Import template
				</Button>
			</div>

			<Modal show={regenerateTarget !== null} onHide={() => setRegenerateTarget(null)} centered>
				<Modal.Header closeButton>
					<Modal.Title>Regenerate rundowns from template</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<p>
						Replace today and future rundowns generated from{' '}
						<strong>{regenerateTarget?.name}</strong> with fresh copies from the current
						template.
					</p>
					<p className="text-muted small mb-0">
						Rundowns you edited after generation are skipped. Past dates are not changed.
					</p>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => setRegenerateTarget(null)}>
						Cancel
					</Button>
					<Button variant="warning" disabled={busyId !== null} onClick={() => void confirmRegenerate()}>
						Regenerate
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	)
}
