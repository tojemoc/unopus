import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { Alert, Button, ButtonGroup, Form } from 'react-bootstrap'
import type { ApplicationSettings } from '~backend/background/interfaces'
import { CoreConnectionStatus } from '~backend/background/interfaces'
import { FieldInfo } from '../form'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { updateSettings } from '~/store/settings'
import { ipcAPI } from '~/lib/IPC'
import { useToasts } from '../toasts/useToasts'
import { friendlyLabel } from '~/util/fieldLabels'
import { clearPreviewBaseUrlCache } from '~/lib/mediaApi'

function normalizeOptionalUrl(value: string | undefined): string | undefined {
	const trimmed = value?.trim()
	if (!trimmed) return undefined
	return trimmed.replace(/\/+$/, '')
}

export function CoreConnectionSettingsForm({ settings }: { settings: ApplicationSettings }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const connectionStatus = useAppSelector((s) => s.coreConnectionStatus)
	const rundowns = useAppSelector((s) => s.rundowns)
	const templateRundowns = rundowns.filter((rundown) => rundown.isTemplate)
	const [testMessage, setTestMessage] = useState<string | null>(null)
	const [testVariant, setTestVariant] = useState<'success' | 'danger'>('success')
	const [testing, setTesting] = useState(false)

	const form = useForm({
		defaultValues: settings,
		onSubmit: async (values) => {
			try {
				const nextSettings: ApplicationSettings = {
					...values.value,
					ingestMediaRoot: values.value.ingestMediaRoot?.trim() || undefined,
					previewBaseUrl: normalizeOptionalUrl(values.value.previewBaseUrl)
				}
				await dispatch(updateSettings({ settings: nextSettings })).unwrap()
				clearPreviewBaseUrlCache()
				form.reset()
			} catch (e) {
				console.error(e)
				toasts.show({
					headerContent: 'Saving settings',
					bodyContent: e instanceof Error ? e.message : 'Encountered an unexpected error'
				})
			}
		}
	})

	const testConnection = async () => {
		setTesting(true)
		setTestMessage(null)
		try {
			await dispatch(updateSettings({ settings: form.state.values })).unwrap()
			const info = await ipcAPI.getCoreConnectionInfo()
			if (info.status === CoreConnectionStatus.CONNECTED) {
				setTestVariant('success')
				setTestMessage('Connected to Sofie Core')
			} else {
				setTestVariant('danger')
				setTestMessage(
					'Could not connect — check the URL and make sure Sofie Core is running.'
				)
			}
		} catch (error) {
			console.error('Core connection test failed:', error)
			setTestVariant('danger')
			setTestMessage('Could not connect — check the URL and make sure Sofie Core is running.')
		} finally {
			setTesting(false)
		}
	}

	return (
		<div>
			<Form
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit()
				}}
			>
				<form.Field
					name="coreUrl"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('coreUrl')}</Form.Label>
								<Form.Control
									name={field.name}
									type="text"
									value={field.state.value}
									onBlur={field.handleBlur}
									placeholder="127.0.0.1"
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>
				<form.Field
					name="corePort"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('corePort')}</Form.Label>
								<Form.Control
									name={field.name}
									type="number"
									value={field.state.value}
									onBlur={field.handleBlur}
									placeholder="3000"
									onChange={(e) => field.handleChange(Number(e.target.value))}
								/>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<form.Field
					name="ingestMediaRoot"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('ingestMediaRoot')}</Form.Label>
								<Form.Control
									name={field.name}
									type="text"
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									placeholder="../ingest"
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<Form.Text className="text-muted">
									Clips are listed from{' '}
									<code>
										&lt;ingest root&gt;/clips/
									</code>{' '}
									(also <code>loops/</code>, <code>wipes/</code>). File name / ILU clip fields
									use two-level paths like <code>clips/foo.mp4</code> — same layout Sofie Package
									Manager expects. Overrides <code>INGEST_MEDIA_ROOT</code> in backend{' '}
									<code>.env</code> when set. In Docker this is often <code>/app/ingest</code> —
									mount your media tree there or change this setting.
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>
				<form.Field
					name="previewBaseUrl"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('previewBaseUrl')}</Form.Label>
								<Form.Control
									name={field.name}
									type="url"
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									placeholder="http://localhost:3010/demo-assets"
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<Form.Text className="text-muted">
									Base URL for GFX preview iframe templates (must serve{' '}
									<code>&lt;template&gt;/index.html</code> files, not the Sofie Rundown Editor
									app). Example:{' '}
									<code>https://duopus.tjm.sk/demo-assets</code>. Overrides{' '}
									<code>PREVIEW_BASE_URL</code> in backend <code>.env</code> when set. If you use
									nginx in front of the app, ensure <code>/demo-assets/</code> is served as static
									files (see README).
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<hr className="my-4" />
				<h3 className="h5">Daily template clone</h3>
				<p className="text-muted small">
					When a template and clone time are set, the backend clones that template once per day
					after the configured wall-clock time (idempotent — safe to restart). Leave either blank
					to keep the feature inert.
				</p>

				<form.Field
					name="dailyTemplateRundownId"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>
									{friendlyLabel('dailyTemplateRundownId')}
								</Form.Label>
								<Form.Select
									id={field.name}
									name={field.name}
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value || undefined)}
								>
									<option value="">— Not configured —</option>
									{templateRundowns.map((rundown) => (
										<option key={rundown.id} value={rundown.id}>
											{rundown.name}
										</option>
									))}
								</Form.Select>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<form.Field
					name="dailyCloneTime"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('dailyCloneTime')}</Form.Label>
								<Form.Control
									id={field.name}
									name={field.name}
									type="time"
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value || undefined)}
								/>
								<Form.Text className="text-muted">
									Local wall-clock time (<code>HH:mm</code>) in the timezone below. No default —
									leave empty to disable scheduled cloning.
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<form.Field
					name="dailyCloneTimezone"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>
									{friendlyLabel('dailyCloneTimezone')}
								</Form.Label>
								<Form.Control
									id={field.name}
									name={field.name}
									type="text"
									value={field.state.value ?? 'Europe/Bratislava'}
									onBlur={field.handleBlur}
									placeholder="Europe/Bratislava"
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<Form.Text className="text-muted">
									IANA timezone (default <code>Europe/Bratislava</code>).
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<hr className="my-4" />
				<h3 className="h5">Script timing &amp; editorial</h3>
				<p className="text-muted small">
					Reading-time estimates drive ILU story length. SYN / VO / VT length still comes from
					ffprobe on the linked clip. Per-user CPS can also be tweaked next to any script field
					(saved in this browser).
				</p>

				<form.Field
					name="scriptCps"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('scriptCps')}</Form.Label>
								<Form.Control
									id={field.name}
									name={field.name}
									type="number"
									min={5}
									max={40}
									step={1}
									value={field.state.value ?? 15}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(Number(e.target.value))}
								/>
								<Form.Text className="text-muted">
									Default characters per second for script → mm:ss estimates (5–40). Default 15.
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<form.Field
					name="iluDurationMode"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>{friendlyLabel('iluDurationMode')}</Form.Label>
								<Form.Select
									id={field.name}
									name={field.name}
									value={field.state.value ?? 'auto'}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(e.target.value === 'manual' ? 'manual' : 'auto')
									}
								>
									<option value="auto">Auto — Sofie may take after reading time</option>
									<option value="manual">Manual — wait for take (duration still sent)</option>
								</Form.Select>
								<Form.Text className="text-muted">
									When Auto, ILU parts export <code>autoNext: true</code> so Sofie can skip after
									the script duration. Manual keeps the duration but does not request auto-take.
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<form.Field
					name="skipStatusUnlessEditorChecked"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>
									{friendlyLabel('skipStatusUnlessEditorChecked')}
								</Form.Label>
								<Form.Switch
									id={field.name}
									name={field.name}
									checked={field.state.value !== false}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.checked)}
								/>
								<Form.Text className="text-muted">
									Skipped stories/pieces show an SK status unless marked checked by an editor.
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<form.Field
					name="requireEditorCheckForAir"
					children={(field) => (
						<>
							<Form.Group className="mb-3">
								<Form.Label htmlFor={field.name}>
									{friendlyLabel('requireEditorCheckForAir')}
								</Form.Label>
								<Form.Switch
									id={field.name}
									name={field.name}
									checked={Boolean(field.state.value)}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.checked)}
								/>
								<Form.Text className="text-muted">
									When enabled, stories without editor check show an unchecked status (prerequisite
									signal for going on air).
								</Form.Text>
							</Form.Group>
							<FieldInfo field={field} />
						</>
					)}
				/>

				<div className="mb-3">
					<Button variant="outline-primary" onClick={() => void testConnection()} disabled={testing}>
						{testing ? 'Testing…' : 'Test Connection'}
					</Button>
					{connectionStatus.status === CoreConnectionStatus.CONNECTED && !testMessage && (
						<span className="text-success ms-3 small">Currently connected</span>
					)}
				</div>
				{testMessage && <Alert variant={testVariant}>{testMessage}</Alert>}

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine]}
					children={([canSubmit, isSubmitting, isPristine]) => (
						<div className="d-flex justify-content-end">
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
