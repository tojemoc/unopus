import { useForm } from '@tanstack/react-form'
import { Button, ButtonGroup, Form, Modal } from 'react-bootstrap'
import type { Piece } from '~backend/background/interfaces'
import { ManifestFieldType } from '~backend/background/interfaces'
import { FieldInfo } from '../form'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { removePiece, updatePiece } from '~/store/pieces'
import { useToasts } from '../toasts/useToasts'
import { MediaPickerField } from './mediaPickerField'
import { GfxPreview } from './gfxPreview'

/** Source toggle: explicit value wins; otherwise legacy non-empty source counts as on. */
function resolveSourceEnabled(enabledValue: unknown, sourceText: unknown): boolean {
	if (enabledValue === true || enabledValue === 'true') return true
	if (enabledValue === false || enabledValue === 'false') return false
	return typeof sourceText === 'string' && sourceText.trim().length > 0
}

export function PiecePropertiesForm({ piece }: { piece: Piece }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	const manifest = useAppSelector((state) =>
		state.typeManifests.manifests?.find((p) => p.id === piece.pieceType)
	)

	const form = useForm({
		defaultValues: piece,
		onSubmit: async (values) => {
			try {
				await dispatch(updatePiece({ piece: values.value })).unwrap()

				// Mark as pristine
				form.reset()
			} catch (e) {
				console.error(e)
				toasts.show({
					headerContent: 'Saving piece',
					bodyContent: 'Encountered an unexpected error'
				})
			}
		}
	})

	return (
		<div>
			<h2>Piece</h2>

			<form.Subscribe
				selector={(state) => state.values.payload}
				children={(payload) => (
					<GfxPreview
						piece={piece}
						manifest={manifest}
						payload={(payload ?? {}) as Record<string, unknown>}
					/>
				)}
			/>

			<Form
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit()
				}}
			>
				<Form.Group className="mb-3">
					<Form.Text>
						Piece type: {piece.pieceType} {!piece.start && piece.start !== 0 ? '(AdLib)' : ''}
					</Form.Text>
				</Form.Group>

				<form.Field
					name="name"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>Name:</Form.Label>
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
					name="start"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>Start (seconds):</Form.Label>
								<Form.Control
									name={field.name}
									type="number"
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									onChange={(e) => {
										const val = e.target.value
										field.handleChange(val === '' ? undefined : Number(val))
									}}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>
				<form.Field
					name="duration"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>Duration (seconds):</Form.Label>
								<Form.Control
									name={field.name}
									type="number"
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									onChange={(e) => {
										const val = e.target.value
										field.handleChange(val === '' ? undefined : Number(val))
									}}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				{manifest?.payload?.map((fieldInfo) => {
					const hasSourceToggle = manifest.payload?.some((f) => f.id === 'sourceEnabled')
					// Source text is rendered together with the Source toggle.
					if (fieldInfo.id === 'source' && hasSourceToggle) {
						return null
					}

					if (fieldInfo.id === 'sourceEnabled') {
						return (
							<form.Field
								key={`payload.${fieldInfo.id}`}
								name={`payload.${fieldInfo.id}`}
								children={(enabledField) => (
									<form.Field
										name="payload.source"
										children={(sourceField) => {
											const sourceText =
												typeof sourceField.state.value === 'string'
													? sourceField.state.value
													: ''
											const enabled = resolveSourceEnabled(
												enabledField.state.value,
												sourceText
											)
											const showEmptyWarning = enabled && !sourceText.trim()

											return (
												<>
													<Form.Group className="mb-3">
														<Form.Label htmlFor={enabledField.name}>
															{fieldInfo.label}:
														</Form.Label>
														<Form.Switch
															name={enabledField.name}
															id={enabledField.name}
															checked={enabled}
															onBlur={enabledField.handleBlur}
															onChange={(e) =>
																enabledField.handleChange(e.target.checked)
															}
														/>
														{enabled && (
															<>
																<Form.Control
																	className="mt-2"
																	name={sourceField.name}
																	type="text"
																	placeholder="e.g. TASR, ČTK, Reuters…"
																	value={sourceText}
																	onBlur={sourceField.handleBlur}
																	onChange={(e) =>
																		sourceField.handleChange(e.target.value)
																	}
																/>
																{showEmptyWarning ? (
																	<Form.Text className="text-warning d-block mt-1">
																		Source is on but empty — the on-air pill will be
																		hidden until text is entered.
																	</Form.Text>
																) : (
																	<Form.Text className="text-muted d-block mt-1">
																		Shown as a source pill on air.
																	</Form.Text>
																)}
															</>
														)}
													</Form.Group>
													<FieldInfo field={enabledField} />
													<FieldInfo field={sourceField} />
												</>
											)
										}}
									/>
								)}
							/>
						)
					}

					return (
						<form.Field
							key={`payload.${fieldInfo.id}`}
							name={`payload.${fieldInfo.id}`}
							children={(field) => (
								<>
									<Form.Group className="mb-3">
										<Form.Label htmlFor={field.name}>{fieldInfo.label}:</Form.Label>

										{fieldInfo.type === ManifestFieldType.String &&
											fieldInfo.options &&
											fieldInfo.options.length > 0 && (
												<div>
													<ButtonGroup role="radiogroup" aria-label={fieldInfo.label}>
														{fieldInfo.options.map((option) => (
															<Button
																key={option}
																type="button"
																role="radio"
																aria-checked={(field.state.value || '') === option}
																variant={
																	(field.state.value || '') === option
																		? 'primary'
																		: 'outline-secondary'
																}
																onClick={() => field.handleChange(option)}
															>
																{option || 'None'}
															</Button>
														))}
													</ButtonGroup>
													{fieldInfo.optionsHelperText && (
														<Form.Text className="text-muted d-block mt-1">
															{fieldInfo.optionsHelperText}
														</Form.Text>
													)}
												</div>
											)}

										{fieldInfo.type === ManifestFieldType.String &&
											(!fieldInfo.options || fieldInfo.options.length === 0) && (
												<Form.Control
													name={field.name}
													type="text"
													// eslint-disable-next-line @typescript-eslint/no-explicit-any
													value={field.state.value as any}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
												/>
											)}

										{fieldInfo.type === ManifestFieldType.Number && (
											<Form.Control
												name={field.name}
												type="number"
												value={Number(field.state.value)}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(Number(e.target.value))}
											/>
										)}

										{fieldInfo.type === ManifestFieldType.Boolean && (
											<Form.Switch
												name={field.name}
												type="text"
												checked={Boolean(field.state.value)}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.checked)}
											/>
										)}

										{fieldInfo.type === ManifestFieldType.MediaPick && (
											<MediaPickerField
												name={field.name}
												rundownId={piece.rundownId}
												subdir={fieldInfo.subdir ?? 'clips'}
												value={field.state.value as string | undefined}
												onBlur={field.handleBlur}
												onChange={(value) => field.handleChange(value)}
											/>
										)}
									</Form.Group>
									<FieldInfo field={field} />
								</>
							)}
						/>
					)
				})}

				{!manifest && (
					<Form.Group className="mb-3">
						<Form.Text>Piece type not found</Form.Text>
					</Form.Group>
				)}

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine]}
					children={([canSubmit, isSubmitting, isPristine]) => (
						<div className="d-flex justify-content-between">
							<DeletePieceButton
								rundownId={piece.rundownId}
								segmentId={piece.segmentId}
								partId={piece.partId}
								pieceId={piece.id}
								pieceName={piece.name}
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
								<Button type="submit" disabled={!canSubmit || isPristine} variant="primary">
									{isSubmitting ? '...' : 'Save'}
								</Button>
							</ButtonGroup>
						</div>
					)}
				/>
			</Form>
		</div>
	)
}

function DeletePieceButton({
	rundownId,
	segmentId,
	partId,
	pieceId,
	pieceName,
	disabled
}: {
	rundownId: string
	segmentId: string
	partId: string
	pieceId: string
	pieceName: string
	disabled: boolean
}) {
	const navigate = useNavigate({
		from: '/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId'
	})
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	const [showDelete, setShowDelete] = useState(false)
	const handleDeleteClose = () => setShowDelete(false)

	const deleteSegment = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		setShowDelete(true)
	}
	const performDeleteSegment = () => {
		// Navigate user to the list of parts
		navigate({
			to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
			params: { rundownId, segmentId, partId }
		})

		// perform operation
		dispatch(removePiece({ id: pieceId })).catch((e) => {
			console.error(e)
			toasts.show({
				headerContent: 'Deleting piece',
				bodyContent: 'Encountered an unexpected error'
			})
		})
	}

	return (
		<>
			<Button onClick={deleteSegment} disabled={disabled} variant="danger">
				Delete
			</Button>

			<Modal show={showDelete} onHide={handleDeleteClose}>
				<Modal.Header closeButton>
					<Modal.Title>Delete piece</Modal.Title>
				</Modal.Header>
				<Modal.Body>Are you sure you want to delete "{pieceName}"?</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={handleDeleteClose}>
						Cancel
					</Button>
					<Button variant="danger" onClick={performDeleteSegment}>
						Delete
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	)
}
