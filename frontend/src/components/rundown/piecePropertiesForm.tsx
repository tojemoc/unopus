import { useForm } from '@tanstack/react-form'
import { Button, ButtonGroup, Col, Form, Modal, Row } from 'react-bootstrap'
import type { Piece, PayloadManifest, TypeManifest } from '~backend/background/interfaces'
import { ManifestFieldType, TypeManifestEntity } from '~backend/background/interfaces'
import { FieldInfo } from '../form'
import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { removePiece, updatePiece } from '~/store/pieces'
import { updatePart } from '~/store/parts'
import { useToasts } from '../toasts/useToasts'
import { MediaPickerField } from './mediaPickerField'
import { GfxPreview } from './gfxPreview'
import { ClipPreview } from './clipPreview'
import { ScriptReadingCounter } from './scriptReadingCounter'
import { resolveSourceEnabled } from '~/util/sourcePayload'
import {
	DEFAULT_WIPE_DURATION_SECONDS,
	WIPE_CUT_POINT_SECONDS,
	formatSecondsPrecise,
	getPieceSourceDurationSeconds
} from '~/util/pieceDuration'
import {
	isBypassClipField,
	isBypassField,
	isHeadlineField,
	isPrimaryClipField,
	isPrimaryContentField,
	isSourceField,
	resolveClipPreviewPath,
	resolvePieceName,
	previewPayloadSnapshotKey
} from '~/util/pieceName'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PieceFormApi = any

function categorizePayloadFields(manifest: TypeManifest | undefined) {
	const clip: PayloadManifest[] = []
	const headline: PayloadManifest[] = []
	const content: PayloadManifest[] = []
	const bypass: PayloadManifest[] = []
	const source: PayloadManifest[] = []
	const other: PayloadManifest[] = []

	for (const field of manifest?.payload ?? []) {
		if (field.id === 'sourceDuration') {
			continue
		}
		if (field.id === 'source' && manifest?.payload?.some((f) => f.id === 'sourceEnabled')) {
			continue
		}
		if (isPrimaryClipField(field)) {
			clip.push(field)
		} else if (isHeadlineField(field)) {
			headline.push(field)
		} else if (isBypassField(field) || isBypassClipField(field, manifest)) {
			bypass.push(field)
		} else if (isSourceField(field)) {
			source.push(field)
		} else if (isPrimaryContentField(field)) {
			content.push(field)
		} else {
			other.push(field)
		}
	}

	return { clip, headline, content, bypass, source, other }
}

function PayloadField({
	form,
	fieldInfo,
	piece,
	durationFromMediaRef
}: {
	form: PieceFormApi
	fieldInfo: PayloadManifest
	piece: Piece
	durationFromMediaRef: React.MutableRefObject<boolean>
}) {
	return (
		<form.Field
			key={`payload.${fieldInfo.id}`}
			name={`payload.${fieldInfo.id}`}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			children={(field: any) => (
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
								<>
									<Form.Control
										id={field.name}
										name={field.name}
										type="text"
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										value={field.state.value as any}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{(fieldInfo.id === 'text' ||
										fieldInfo.id === 'script' ||
										fieldInfo.id === 'headline') && (
										<ScriptReadingCounter
											text={
												typeof field.state.value === 'string'
													? field.state.value
													: String(field.state.value ?? '')
											}
										/>
									)}
								</>
							)}

						{fieldInfo.type === ManifestFieldType.Number && (
							<Form.Control
								id={field.name}
								name={field.name}
								type="number"
								value={
									field.state.value === undefined ||
									field.state.value === null ||
									field.state.value === ''
										? ''
										: Number(field.state.value)
								}
								onBlur={field.handleBlur}
								onChange={(e) => {
									const val = e.target.value
									field.handleChange(val === '' ? undefined : Number(val))
								}}
							/>
						)}

						{fieldInfo.type === ManifestFieldType.Boolean && (
							<Form.Switch
								id={field.name}
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
								onDurationSeconds={(durationSeconds) => {
									if (
										typeof durationSeconds !== 'number' ||
										!Number.isFinite(durationSeconds) ||
										durationSeconds <= 0
									) {
										return
									}
									if (fieldInfo.id !== 'fileName' && fieldInfo.id !== 'iluFile') {
										return
									}
									form.setFieldValue('duration', durationSeconds)
									form.setFieldValue(
										'payload.sourceDuration',
										Math.round(durationSeconds * 1000)
									)
									durationFromMediaRef.current = true
								}}
							/>
						)}
					</Form.Group>
					<FieldInfo field={field} />
				</>
			)}
		/>
	)
}

function SourceToggleField({
	form,
	fieldInfo
}: {
	form: PieceFormApi
	fieldInfo: PayloadManifest
}) {
	return (
		<form.Field
			key={`payload.${fieldInfo.id}`}
			name={`payload.${fieldInfo.id}`}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			children={(enabledField: any) => (
				<form.Field
					name="payload.source"
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					children={(sourceField: any) => {
						const sourceText =
							typeof sourceField.state.value === 'string' ? sourceField.state.value : ''
						const enabled = resolveSourceEnabled(enabledField.state.value, sourceText)
						const showEmptyWarning = enabled && !sourceText.trim()

						return (
							<>
								<Form.Group className="mb-3">
									<Form.Label htmlFor={enabledField.name}>{fieldInfo.label}:</Form.Label>
									<Form.Switch
										name={enabledField.name}
										id={enabledField.name}
										checked={enabled}
										onBlur={enabledField.handleBlur}
										onChange={(e) => enabledField.handleChange(e.target.checked)}
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
												onChange={(e) => sourceField.handleChange(e.target.value)}
											/>
											{showEmptyWarning ? (
												<Form.Text className="text-warning d-block mt-1">
													Source is on but empty — the on-air pill will be hidden until text is
													entered.
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

export function PiecePropertiesForm({ piece }: { piece: Piece }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	const manifest = useAppSelector((state) =>
		state.typeManifests.manifests?.find(
			(p) => p.id === piece.pieceType && p.entityType === TypeManifestEntity.Piece
		)
	)
	const parentPart = useAppSelector((state) => state.parts.parts?.find((p) => p.id === piece.partId))
	const durationFromMediaRef = useRef(false)

	const { clip, headline, content, bypass, source, other } = categorizePayloadFields(manifest)

	const form = useForm({
		defaultValues: piece,
		onSubmit: async (values) => {
			const mergedPayload = {
				...(piece.payload ?? {}),
				...(values.value.payload ?? {})
			}
			const derivedName = resolvePieceName(manifest, mergedPayload, piece.name)

			const pieceToSave: Piece = {
				...values.value,
				name: derivedName,
				payload: mergedPayload
			}

			let updatedPiece: Piece
			try {
				updatedPiece = await dispatch(updatePiece({ piece: pieceToSave })).unwrap()
			} catch (e) {
				console.error(e)
				toasts.show({
					headerContent: 'Saving piece',
					bodyContent: 'Encountered an unexpected error'
				})
				return
			}

			const nextDuration = values.value.duration
			if (
				durationFromMediaRef.current &&
				parentPart &&
				typeof nextDuration === 'number' &&
				Number.isFinite(nextDuration) &&
				nextDuration > 0 &&
				parentPart.duration !== nextDuration
			) {
				try {
					await dispatch(
						updatePart({
							part: {
								...parentPart,
								duration: nextDuration
							}
						})
					).unwrap()
				} catch (e) {
					console.error(e)
					toasts.show({
						headerContent: 'Updating part duration',
						bodyContent: 'Piece saved, but part duration could not be synchronized'
					})
					form.reset(updatedPiece)
					return
				}
			}

			durationFromMediaRef.current = false
			form.reset(updatedPiece)
		}
	})

	return (
		<div className="piece-properties-form">
			<Form
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit()
				}}
			>
				<form.Subscribe
					selector={(state) => previewPayloadSnapshotKey(manifest, state.values.payload)}
					children={(snapshotKey) => {
						const payloadRecord = (snapshotKey ? JSON.parse(snapshotKey) : {}) as Record<
							string,
							unknown
						>
						const displayName = resolvePieceName(manifest, payloadRecord, piece.name)
						return (
							<div className="piece-properties-form__header mb-3">
								<h2 className="mb-1">{displayName}</h2>
								<Form.Text>{manifest?.name ?? piece.pieceType}</Form.Text>
							</div>
						)
					}}
				/>

				{clip.map((fieldInfo) => (
					<PayloadField
						key={fieldInfo.id}
						form={form}
						fieldInfo={fieldInfo}
						piece={piece}
						durationFromMediaRef={durationFromMediaRef}
					/>
				))}

				{headline.map((fieldInfo) => (
					<PayloadField
						key={fieldInfo.id}
						form={form}
						fieldInfo={fieldInfo}
						piece={piece}
						durationFromMediaRef={durationFromMediaRef}
					/>
				))}

				{content.map((fieldInfo) => (
					<PayloadField
						key={fieldInfo.id}
						form={form}
						fieldInfo={fieldInfo}
						piece={piece}
						durationFromMediaRef={durationFromMediaRef}
					/>
				))}

				<form.Subscribe
					selector={(state) => previewPayloadSnapshotKey(manifest, state.values.payload)}
					children={(snapshotKey) => {
						const payloadRecord = (snapshotKey ? JSON.parse(snapshotKey) : {}) as Record<
							string,
							unknown
						>
						const clipPath = resolveClipPreviewPath(manifest, payloadRecord)
						return (
							<div className="piece-properties-form__previews">
								<GfxPreview piece={piece} manifest={manifest} payload={payloadRecord} />
								<ClipPreview clipPath={clipPath} />
							</div>
						)
					}}
				/>

				<Row className="g-2 mb-3 piece-properties-form__timing">
					<Col xs={6}>
						<form.Field
							name="start"
							children={(field) => (
								<>
									<Form.Group>
										<Form.Label htmlFor={field.name} className="small mb-1">
											Start (s)
										</Form.Label>
										<Form.Control
											size="sm"
											id={field.name}
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
					</Col>
					<Col xs={6}>
						<form.Field
							name="duration"
							children={(field) => {
								const isWipeDefault =
									piece.pieceType === 'wipe' &&
									(field.state.value === undefined ||
										field.state.value === null ||
										field.state.value === 0)

								return (
									<>
										<Form.Group>
											<Form.Label htmlFor={field.name} className="small mb-1">
												On air (s)
											</Form.Label>
											<Form.Control
												size="sm"
												id={field.name}
												name={field.name}
												type="number"
												value={field.state.value ?? ''}
												placeholder={
													piece.pieceType === 'wipe'
														? String(DEFAULT_WIPE_DURATION_SECONDS)
														: undefined
												}
												onBlur={field.handleBlur}
												onChange={(e) => {
													const val = e.target.value
													field.handleChange(val === '' ? undefined : Number(val))
												}}
											/>
											{isWipeDefault ? (
												<Form.Text muted className="small">
													Default {DEFAULT_WIPE_DURATION_SECONDS}s · cut at{' '}
													{formatSecondsPrecise(WIPE_CUT_POINT_SECONDS)}
												</Form.Text>
											) : null}
										</Form.Group>
										<FieldInfo field={field} />
									</>
								)
							}}
						/>
					</Col>
				</Row>

				<form.Subscribe
					selector={(state) => state.values.payload?.sourceDuration}
					children={(sourceDurationMs) => {
						const sourceDurationSeconds = getPieceSourceDurationSeconds({
							payload: { sourceDuration: sourceDurationMs }
						})
						if (sourceDurationSeconds === undefined) {
							return null
						}
						return (
							<Form.Group className="mb-3">
								<Form.Label className="small mb-1">Source length (s)</Form.Label>
								<Form.Control
									size="sm"
									style={{ maxWidth: '8rem' }}
									type="number"
									value={sourceDurationSeconds}
									readOnly
									disabled
								/>
								<Form.Text muted className="small">
									From media probe (read-only)
								</Form.Text>
							</Form.Group>
						)
					}}
				/>

				<Row className="g-2 mb-3 piece-properties-form__editorial">
									<Col xs={6}>
										<form.Field
											name="editorChecked"
											children={(field) => (
												<>
													<Form.Group>
														<Form.Check
															type="switch"
															id={field.name}
															label="Checked"
															checked={Boolean(field.state.value)}
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.checked)}
														/>
													</Form.Group>
													<FieldInfo field={field} />
												</>
											)}
										/>
									</Col>
									<Col xs={6}>
										<form.Field
											name="skip"
											children={(field) => (
												<>
													<Form.Group>
														<Form.Check
															type="switch"
															id={field.name}
															label="Skipped"
															checked={Boolean(field.state.value)}
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.checked)}
														/>
														<Form.Text className="text-muted small">
															Excluded from timing and export
														</Form.Text>
													</Form.Group>
													<FieldInfo field={field} />
												</>
											)}
										/>
									</Col>
								</Row>

								{(source.length > 0 || bypass.length > 0) && (
									<div className="piece-properties-form__source-bypass mb-2">
										{source.map((fieldInfo) =>
											fieldInfo.id === 'sourceEnabled' ? (
												<SourceToggleField
													key={fieldInfo.id}
													form={form}
													fieldInfo={fieldInfo}
												/>
											) : (
												<PayloadField
													key={fieldInfo.id}
													form={form}
													fieldInfo={fieldInfo}
													piece={piece}
													durationFromMediaRef={durationFromMediaRef}
												/>
											)
										)}
										{bypass.map((fieldInfo) => (
											<PayloadField
												key={fieldInfo.id}
												form={form}
												fieldInfo={fieldInfo}
												piece={piece}
												durationFromMediaRef={durationFromMediaRef}
											/>
										))}
									</div>
								)}

								{other.map((fieldInfo) => (
									<PayloadField
										key={fieldInfo.id}
										form={form}
										fieldInfo={fieldInfo}
										piece={piece}
										durationFromMediaRef={durationFromMediaRef}
									/>
								))}

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
												<Button
													type="submit"
													disabled={!canSubmit || isPristine}
													variant="primary"
												>
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
		navigate({
			to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
			params: { rundownId, segmentId, partId }
		})

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
