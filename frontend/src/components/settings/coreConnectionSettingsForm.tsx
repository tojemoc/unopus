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

export function CoreConnectionSettingsForm({ settings }: { settings: ApplicationSettings }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const connectionStatus = useAppSelector((s) => s.coreConnectionStatus)
	const [testMessage, setTestMessage] = useState<string | null>(null)
	const [testVariant, setTestVariant] = useState<'success' | 'danger'>('success')
	const [testing, setTesting] = useState(false)

	const form = useForm({
		defaultValues: settings,
		onSubmit: async (values) => {
			try {
				await dispatch(updateSettings({ settings: values.value })).unwrap()
				form.reset()
			} catch (e) {
				console.error(e)
				toasts.show({
					headerContent: 'Saving settings',
					bodyContent: 'Encountered an unexpected error'
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
