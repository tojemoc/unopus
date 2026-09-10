import { useForm } from '@tanstack/react-form'
import { Button, ButtonGroup, Form, Modal } from 'react-bootstrap'
import type { Part } from '~backend/background/interfaces'
import { FieldInfo } from '../form'
import { useEffect, useMemo, useRef, useState } from 'react'
import { friendlyLabel } from '~/util/fieldLabels'
import { findTypeManifest } from '~/util/typeManifest'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { fetchEntityEdit } from '~/lib/authApi'
import { useNavigate } from '@tanstack/react-router'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { removePart, updatePart } from '~/store/parts'
import { useToasts } from '../toasts/useToasts'
import { formatPartOnAirDuration, resolvePartOnAirDuration, formatSecondsClock } from '~/util/pieceDuration'
import { ScriptReadingCounter } from './scriptReadingCounter'
import { ClockDurationInput } from './clockDurationInput'
import {
	partUsesScriptDuration,
	resolveEffectiveScriptCps
} from '~/util/scriptReadingTime'
import { resolveEffectiveIluDurationMode } from '~backend/background/storyDuration'
import type { IluDurationMode } from '~backend/background/interfaces'

export function PartPropertiesForm({ part }: { part: Part }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const [savedFlash, setSavedFlash] = useState(false)
	const [lastEdit, setLastEdit] = useState<{ displayName: string; editedAt: number } | null>(null)

	const manifests = useAppSelector((state) => state.typeManifests.manifests)
	const livePart = useAppSelector((state) => state.parts.parts.find((p) => p.id === part.id) ?? part)
	const childPieces = useAppSelector((state) =>
		state.pieces.pieces.filter((piece) => piece.partId === part.id)
	)
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const settings = useAppSelector((s) => s.settings.settings)
	const scriptCps = resolveEffectiveScriptCps({
		userScriptCps,
		settingsCps: settings?.scriptCps
	})
	const siteDurationMode = settings?.iluDurationMode ?? 'auto'
	const durationOpts = useMemo(
		() => ({ scriptCps, defaultDurationMode: siteDurationMode }),
		[scriptCps, siteDurationMode]
	)
	const durationChildPieces = useMemo(
		() =>
			childPieces.map((piece) => ({
				pieceType: piece.pieceType,
				duration: piece.duration,
				skip: piece.skip
			})),
		[childPieces]
	)

	useEffect(() => {
		let cancelled = false
		fetchEntityEdit('part', part.id)
			.then((edit) => {
				if (!cancelled) {
					setLastEdit(edit)
				}
			})
			.catch((error) => {
				if (!cancelled) {
					console.error('Failed to load last edit for part', part.id, error)
				}
			})
		return () => {
			cancelled = true
		}
	}, [part.id])

	const form = useForm({
		defaultValues: part,
		onSubmit: async (values) => {
			try {
				const updatedPart = await dispatch(updatePart({ part: values.value })).unwrap()
				form.reset(updatedPart)
				setSavedFlash(true)
				setTimeout(() => setSavedFlash(false), 2000)
				try {
					const edit = await fetchEntityEdit('part', values.value.id)
					setLastEdit(edit)
				} catch (error) {
					console.error('Failed to refresh last edit after save', error)
				}
			} catch (e) {
				console.error(e)
				toasts.show({
					headerContent: 'Saving part',
					bodyContent: 'Encountered an unexpected error'
				})
			}
		}
	})

	const prevPartIdRef = useRef(part.id)

	useEffect(() => {
		if (prevPartIdRef.current !== livePart.id) {
			prevPartIdRef.current = livePart.id
			form.reset(livePart)
			return
		}

		if (form.getFieldMeta('duration')?.isDirty) {
			return
		}

		form.setFieldValue('duration', livePart.duration)
		if (!form.getFieldMeta('durationMode')?.isDirty) {
			form.setFieldValue('durationMode', livePart.durationMode)
		}
	}, [livePart, form])

	return (
		<div className="part-properties-form">
			<h2>Story</h2>
			{lastEdit && (
				<p className="text-muted small">
					Last saved by {lastEdit.displayName} ·{' '}
					{new Date(lastEdit.editedAt).toLocaleString()}
				</p>
			)}

			<Form
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit()
				}}
			>
				<form.Field
					name="name"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>Title</Form.Label>
								<Form.Control
									name={field.name}
									type="text"
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>
				<form.Field
					name="float"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('float')}</Form.Label>
								<Form.Switch
									name={field.name}
									type="text"
									checked={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.checked)}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>
				<form.Field
					name="skip"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('skip')}</Form.Label>
								<Form.Switch
									name={field.name}
									checked={Boolean(field.state.value)}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.checked)}
								/>
								<Form.Text className="text-muted">
									Fades the story, excludes it from timing, and removes it from Sofie while skipped.
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>
				<form.Field
					name="editorChecked"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('editorChecked')}</Form.Label>
								<Form.Switch
									name={field.name}
									checked={Boolean(field.state.value)}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.checked)}
								/>
								<Form.Text className="text-muted">
									Manual editor confirmation. Can be required before on-air in Settings → Connection.
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				{!part.fromPreset && (
					<form.Field
						name="partType"
						children={(field) => (
							<>
								<Form.Group className="mb-3">
									<Form.Label htmlFor={field.name}>{friendlyLabel('partType')}</Form.Label>
									<Form.Select
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									>
										<PartTypeOptions />
									</Form.Select>
								</Form.Group>
								<FieldInfo field={field} />
							</>
						)}
					/>
				)}
				{part.fromPreset && (
					<Form.Group className="mb-3">
						<Form.Text>
							Part type:{' '}
							{findTypeManifest(manifests, part.partType, TypeManifestEntity.Part)?.buttonLabel ??
								findTypeManifest(manifests, part.partType, TypeManifestEntity.Part)?.name ??
								part.partType}
						</Form.Text>
					</Form.Group>
				)}
				<form.Subscribe
					selector={(state) =>
						[state.values.partType, state.values.durationMode, state.values.duration] as const
					}
				>
					{([draftPartType, draftDurationMode, draftDuration]) => {
						const scriptDriven = partUsesScriptDuration(draftPartType)
						const draftEffectiveDurationMode = resolveEffectiveIluDurationMode(
							draftDurationMode,
							siteDurationMode
						)
						const draftEffectivePartDuration = resolvePartOnAirDuration(
							{
								...livePart,
								partType: draftPartType,
								durationMode: draftDurationMode,
								duration: draftDuration
							},
							durationChildPieces,
							durationOpts
						)

						return (
							<>
								{scriptDriven ? (
									<form.Field
										name="durationMode"
										children={(field) => {
											const selectValue: IluDurationMode | '' =
												field.state.value === 'auto' || field.state.value === 'manual'
													? field.state.value
													: ''

											return (
												<>
													<Form.Group className="mb-3">
														<Form.Label htmlFor={field.name}>
															{friendlyLabel('durationMode')}
														</Form.Label>
														<Form.Select
															id={field.name}
															name={field.name}
															value={selectValue}
															onBlur={field.handleBlur}
															onChange={(e) => {
																const next = e.target.value
																field.handleChange(
																	next === 'auto' || next === 'manual'
																		? next
																		: undefined
																)
															}}
														>
															<option value="">
																Site default (
																{siteDurationMode === 'manual'
																	? 'until next take'
																	: 'auto'}
																)
															</option>
															<option value="auto">
																Auto — Sofie may take after On air
															</option>
															<option value="manual">
																Until next take — wait for take
															</option>
														</Form.Select>
														<Form.Text className="text-muted">
															{draftEffectiveDurationMode === 'auto'
																? 'On air follows script reading time (CPS). Sofie may auto-take.'
																: 'On air sticks when you set it. Sofie waits for the next take.'}
														</Form.Text>
													</Form.Group>
													<FieldInfo field={field} />
												</>
											)
										}}
									/>
								) : null}
								<form.Field
									name="duration"
									children={(field) => {
										const storedDuration =
											typeof field.state.value === 'number' &&
											Number.isFinite(field.state.value) &&
											field.state.value > 0
												? field.state.value
												: undefined
										const effectiveHint =
											draftEffectivePartDuration &&
											(!storedDuration || storedDuration !== draftEffectivePartDuration)
												? formatPartOnAirDuration(
														{
															...livePart,
															partType: draftPartType,
															durationMode: draftDurationMode,
															duration: draftDuration
														},
														durationChildPieces,
														durationOpts
													)
												: undefined

										return (
											<>
												<Form.Group className="mb-3">
													<Form.Label htmlFor={field.name}>On air (mm:ss)</Form.Label>
													<ClockDurationInput
														id={field.name}
														name={field.name}
														valueSeconds={storedDuration}
														placeholder={
															draftEffectivePartDuration
																? formatSecondsClock(draftEffectivePartDuration)
																: 'mm:ss'
														}
														onBlur={field.handleBlur}
														onCommit={(seconds) => field.handleChange(seconds)}
													/>
													{scriptDriven && draftEffectiveDurationMode === 'auto' ? (
														<Form.Text className="text-muted">
															Auto mode: ILU duration follows the script reading time
															(CPS). Switch to until next take to keep a manual On air
															length.
														</Form.Text>
													) : null}
													{scriptDriven && draftEffectiveDurationMode === 'manual' ? (
														<Form.Text className="text-muted">
															Until next take: your On air value is kept. Empty uses the
															script estimate for planning only.
														</Form.Text>
													) : null}
													{effectiveHint ? (
														<Form.Text className="text-muted d-block">
															Effective on-air duration: {effectiveHint}
															{!storedDuration
																? ' (from script or child pieces until you set a value)'
																: ''}
														</Form.Text>
													) : null}
												</Form.Group>
												<FieldInfo field={field} />
											</>
										)
									}}
								/>
							</>
						)
					}}
				</form.Subscribe>
				<form.Field
					name="script"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>Script:</Form.Label>
								<Form.Control
									name={field.name}
									as="textarea"
									rows={3}
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<ScriptReadingCounter text={field.state.value} />
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<form.Subscribe selector={(state) => state.values.partType}>
					{(partType) => {
						const manifest = findTypeManifest(manifests, partType, TypeManifestEntity.Part)

						if (!manifest) {
							return (
								<Form.Group className="mb-3">
									<Form.Text>Type not found</Form.Text>
								</Form.Group>
							)
						}

						return (
							<>
								{manifest.payload?.map((fieldInfo) => (
									<form.Field key={`payload.${fieldInfo.id}`} name={`payload.${fieldInfo.id}`}>
										{(field) => (
											<>
												<Form.Group className="mb-3">
													<Form.Label htmlFor={field.name}>{fieldInfo.label}:</Form.Label>

													{fieldInfo.type === 'string' && (
														<Form.Control
															type="text"
															value={String(field.state.value ?? '')}
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.value)}
														/>
													)}

													{fieldInfo.type === 'number' && (
														<Form.Control
															name={field.name}
															type="number"
															value={Number(field.state.value ?? 0)}
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(Number(e.target.value))}
														/>
													)}

													{fieldInfo.type === 'boolean' && (
														<Form.Switch
															name={field.name}
															checked={Boolean(field.state.value)}
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.checked)}
														/>
													)}
												</Form.Group>
												<FieldInfo field={field} />
											</>
										)}
									</form.Field>
								))}
							</>
						)
					}}
				</form.Subscribe>

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine]}
					children={([canSubmit, isSubmitting, isPristine]) => (
						<div className="d-flex justify-content-between">
							<DeletePartButton
								rundownId={part.rundownId}
								segmentId={part.segmentId}
								partId={part.id}
								partName={part.name}
								disabled={!canSubmit}
							/>

							<ButtonGroup>
								<Button
									type="reset"
									onClick={() => form.reset()}
									variant="secondary"
									disabled={isSubmitting || isPristine}
								>
									Discard
								</Button>
								<Button type="submit" disabled={!canSubmit || isPristine} variant="primary" size="lg">
									{savedFlash ? 'Saved ✓' : isSubmitting ? 'Saving…' : 'Save'}
								</Button>
							</ButtonGroup>
						</div>
					)}
				/>
			</Form>
		</div>
	)
}

function PartTypeOptions() {
	const partTypeManifests = useAppSelector((state) =>
		state.typeManifests.manifests?.filter((m) => m.entityType === 'part')
	)

	if (!partTypeManifests?.length) return null

	return partTypeManifests.map((m) => (
		<option key={m.id} value={m.id}>
			{m.name ?? m.id}
		</option>
	))
}

function DeletePartButton({
	rundownId,
	segmentId,
	partId,
	partName,
	disabled
}: {
	rundownId: string
	segmentId: string
	partId: string
	partName: string
	disabled: boolean
}) {
	const navigate = useNavigate({ from: '/rundown/$rundownId/segment/$segmentId/part/$partId' })
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	const [showDelete, setShowDelete] = useState(false)
	const handleDeleteClose = () => setShowDelete(false)

	const deletePart = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		setShowDelete(true)
	}
	const performDeletePart = () => {
		// Navigate user to the list of segments
		navigate({ to: '/rundown/$rundownId/segment/$segmentId', params: { rundownId, segmentId } })

		// perform operation
		dispatch(removePart({ id: partId })).catch((e) => {
			console.error(e)
			toasts.show({
				headerContent: 'Deleting part',
				bodyContent: 'Encountered an unexpected error'
			})
		})
	}

	return (
		<>
			<Button onClick={deletePart} disabled={disabled} variant="danger">
				Delete
			</Button>

			<Modal show={showDelete} onHide={handleDeleteClose}>
				<Modal.Header closeButton>
					<Modal.Title>Delete part</Modal.Title>
				</Modal.Header>
				<Modal.Body>Are you sure you want to delete "{partName}"?</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={handleDeleteClose}>
						Cancel
					</Button>
					<Button variant="danger" onClick={performDeletePart}>
						Delete
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	)
}
