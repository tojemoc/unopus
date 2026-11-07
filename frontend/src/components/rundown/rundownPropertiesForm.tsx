import { useForm } from '@tanstack/react-form'
import { Button, ButtonGroup, Form } from 'react-bootstrap'
import type { Rundown, SerializedRundown } from '~backend/background/interfaces'
import { CustomDateTimePicker, FieldInfo } from '../form'
import { updateRundown } from '~/store/rundowns'
import { useAppDispatch, useAppSelector, useAppStore } from '~/store/app'
import { ipcAPI } from '~/lib/IPC'
import { saveTextToFile } from '~/lib/files'
import { sanitizeRundownFilename, serializedRundownToCsv } from '~/util/rundownToCsv'
import { DeleteRundownButton } from './deleteRundownButton'
import { useToasts } from '../toasts/useToasts'

export function RundownPropertiesForm({ rundown }: { rundown: Rundown }) {
	const dispatch = useAppDispatch()
	const store = useAppStore()
	const toasts = useToasts()

	const metadataFields = useAppSelector((state) =>
		state.typeManifests.manifests?.find((manifest) => manifest.id === 'rundown')
	)?.payload

	// `rundown` can be a stale snapshot (e.g. the list modal captures it when the
	// gear is clicked), so feed the form the live store document — the form API
	// re-applies `defaultValues` on every render and would otherwise reset the
	// fields back to the pre-save values after a successful save.
	const liveRundown = useAppSelector(
		(state) => state.rundowns.find((r) => r.id === rundown.id) ?? rundown
	)

	const form = useForm({
		defaultValues: liveRundown,
		onSubmit: async (values) => {
			const updatedRundown = await dispatch(updateRundown({ rundown: values.value })).unwrap()

			// Mark as pristine
			form.reset(updatedRundown)
		}
	})

	// Fetch fresh data from the backend rather than the store: the segments/parts/pieces
	// slices only hold the currently open rundown, so exporting an unopened rundown
	// would otherwise produce an empty document.
	const buildSerializedRundown = async (): Promise<SerializedRundown | null> => {
		const state = store.getState()

		const rundownDoc = state.rundowns.find((r) => r.id === rundown.id)
		if (!rundownDoc) return null

		const [segments, parts, pieces] = await Promise.all([
			ipcAPI.getSegments({ rundownId: rundown.id }),
			ipcAPI.getParts(rundown.id),
			ipcAPI.getPieces(rundown.id)
		])

		return {
			rundown: rundownDoc,
			segments,
			parts,
			pieces,
			isTemplate: rundownDoc.isTemplate
		}
	}

	const exportRundown = async (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		try {
			const serializedRundown = await buildSerializedRundown()
			if (!serializedRundown) return

			await ipcAPI.saveToFile({
				title: 'Export rundown',
				document: serializedRundown
			})
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Exporting rundown',
				bodyContent: 'Encountered an unexpected error'
			})
		}
	}

	const exportRundownCsv = async (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		try {
			const serializedRundown = await buildSerializedRundown()
			if (!serializedRundown) return

			const csv = serializedRundownToCsv(serializedRundown)
			const filename = sanitizeRundownFilename(serializedRundown.rundown.name)

			await saveTextToFile({
				title: filename,
				contents: csv,
				extension: 'csv'
			})
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Exporting rundown CSV',
				bodyContent: 'Encountered an unexpected error'
			})
		}
	}

	return (
		<div className="rundown-properties-form">
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
								<Form.Label htmlFor={field.name}>Name:</Form.Label>
								<Form.Control
									name={field.name}
									type="text"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>
				<form.Field name="isTemplate">
					{(templateField) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={templateField.name}>Template:</Form.Label>
								<Form.Switch
									name={templateField.name}
									type="text"
									checked={templateField.state.value}
									onBlur={templateField.handleBlur}
									onChange={(e) => {
										const checked = e.target.checked
										templateField.handleChange(checked)
									}}
								/>
							</Form.Group>
							<FieldInfo field={templateField} />
						</>
					)}
				</form.Field>

				<form.Field
					name="expectedStartTime"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>Start time:</Form.Label>
								<CustomDateTimePicker
									name={field.name}
									isClearable
									placeholderText="No start selected"
									selected={field.state.value ? new Date(field.state.value) : null}
									onChange={(date) => field.handleChange(date?.getTime())}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<form.Field
					name="expectedEndTime"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>End time:</Form.Label>
								<CustomDateTimePicker
									name={field.name}
									isClearable
									placeholderText="No end selected"
									selected={field.state.value ? new Date(field.state.value) : null}
									onChange={(date) => field.handleChange(date?.getTime())}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				{metadataFields?.map((fieldInfo) => {
					return (
						<form.Field
							key={`payload.${fieldInfo.id}`}
							name={`payload.${fieldInfo.id}`}
							children={(field) => (
								<>
									<Form.Group className="mb-3">
										<Form.Label htmlFor={field.name}>{fieldInfo.label}:</Form.Label>

										{fieldInfo.type === 'string' && (
											<Form.Control
												name={field.name}
												type="text"
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												value={field.state.value as any}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
										)}

										{fieldInfo.type === 'number' && (
											<Form.Control
												name={field.name}
												type="number"
												value={Number(field.state.value)}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(Number(e.target.value))}
											/>
										)}

										{fieldInfo.type === 'boolean' && (
											<Form.Switch
												name={field.name}
												type="text"
												checked={Boolean(field.state.value)}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.checked)}
											/>
										)}
									</Form.Group>
									<FieldInfo field={field} />
								</>
							)}
						/>
					)
				})}

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine]}
					children={([canSubmit, isSubmitting, isPristine]) => (
						<div className="d-flex justify-content-between">
							<DeleteRundownButton
								rundownId={rundown.id}
								rundownName={rundown.name}
								disabled={!canSubmit}
							/>

							<div>
								<Button onClick={exportRundown} variant="secondary" className="me-2">
									Export JSON
								</Button>
								<Button onClick={exportRundownCsv} variant="secondary" className="me-4">
									Export CSV
								</Button>

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
						</div>
					)}
				/>
			</Form>
		</div>
	)
}
