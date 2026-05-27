import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import type { ApplicationSettings } from '~backend/background/interfaces'
import {
	fetchGoogleSheetsStatus,
	testGoogleSheetsConnection,
	type GoogleSheetsStatus
} from '~/lib/googleSheetsApi'
import { useAppDispatch } from '~/store/app'
import { updateSettings } from '~/store/settings'
import { useToasts } from '../toasts/useToasts'

export function GoogleSheetsSettingsForm({ settings }: { settings: ApplicationSettings }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const [status, setStatus] = useState<GoogleSheetsStatus | null>(null)
	const [loadingStatus, setLoadingStatus] = useState(true)
	const [testing, setTesting] = useState(false)
	const [testMessage, setTestMessage] = useState<string | null>(null)
	const [testVariant, setTestVariant] = useState<'success' | 'danger'>('success')
	const [saving, setSaving] = useState(false)

	const [spreadsheetId, setSpreadsheetId] = useState(
		settings.googleSheetsSpreadsheetId ?? ''
	)
	const [sheetName, setSheetName] = useState(settings.googleSheetsSheetName ?? 'Sheet1')
	const [dataStartRow, setDataStartRow] = useState(String(settings.googleSheetsDataStartRow ?? 2))
	const [credentialsEnvVar, setCredentialsEnvVar] = useState(
		settings.googleSheetsCredentialsEnvVar ?? ''
	)
	const [credentialsPath, setCredentialsPath] = useState(
		settings.googleSheetsCredentialsPath ?? ''
	)
	const [useBundledNrcsFallback, setUseBundledNrcsFallback] = useState(
		settings.googleSheetsUseBundledNrcsFallback ?? false
	)

	const refreshStatus = useCallback(async () => {
		setLoadingStatus(true)
		try {
			setStatus(await fetchGoogleSheetsStatus())
		} catch {
			setStatus(null)
		} finally {
			setLoadingStatus(false)
		}
	}, [])

	useEffect(() => {
		void refreshStatus()
	}, [refreshStatus])

	const saveSheetsSettings = async (): Promise<boolean> => {
		setSaving(true)
		try {
			const row = Math.max(Number(dataStartRow) || 2, 1)
			await dispatch(
				updateSettings({
					settings: {
						...settings,
						googleSheetsSpreadsheetId: spreadsheetId.trim() || undefined,
						googleSheetsSheetName: sheetName.trim() || undefined,
						googleSheetsDataStartRow: row,
						googleSheetsCredentialsEnvVar: credentialsEnvVar.trim() || undefined,
						googleSheetsCredentialsPath: credentialsPath.trim() || undefined,
						googleSheetsUseBundledNrcsFallback: useBundledNrcsFallback
					}
				})
			).unwrap()
			await refreshStatus()
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: 'Settings saved'
			})
			return true
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: 'Could not save settings'
			})
			return false
		} finally {
			setSaving(false)
		}
	}

	const runTest = async () => {
		setTesting(true)
		setTestMessage(null)
		const saved = await saveSheetsSettings()
		if (!saved) {
			setTesting(false)
			return
		}
		try {
			const result = await testGoogleSheetsConnection()
			if (result.ok) {
				setTestVariant('success')
				setTestMessage(
					`Connected to “${result.title ?? 'spreadsheet'}”` +
						(result.sheetTitle ? ` (sheet: ${result.sheetTitle})` : '') +
						' — read and write verified'
				)
			} else {
				setTestVariant('danger')
				setTestMessage(result.error ?? 'Connection test failed')
			}
			await refreshStatus()
		} catch (e) {
			setTestVariant('danger')
			setTestMessage(e instanceof Error ? e.message : 'Connection test failed')
		} finally {
			setTesting(false)
		}
	}

	const configured = status?.configured ?? false

	return (
		<section className="mt-4 pt-3 border-top border-secondary">
			<h3 className="h5">Google Sheets (NRCS export)</h3>
			<p className="text-muted small">
				Used by the NRCS → Sheets adapter to push automation rows for vMix. Configure here, then
				use <strong>Sheets</strong> in the rundown editor to sync. Service account credentials are
				read from environment variables or a server path — they are not stored in the database.
			</p>

			{loadingStatus ? (
				<Spinner animation="border" size="sm" className="mb-2" />
			) : (
				<Alert variant={configured ? 'success' : 'warning'} className="py-2 small">
					{configured
						? 'Configured — spreadsheet and credentials are available.'
						: 'Not fully configured — set spreadsheet ID and credentials via env or path below.'}
					{status && !configured && status.hasCredentials && !status.spreadsheetId && (
						<span> Credentials are set; spreadsheet ID is missing.</span>
					)}
				</Alert>
			)}

			<Form.Group className="mb-2">
				<Form.Label>Spreadsheet ID</Form.Label>
				<Form.Control
					value={spreadsheetId}
					onChange={(e) => setSpreadsheetId(e.target.value)}
					placeholder="From the Google Sheets URL"
				/>
			</Form.Group>
			<Form.Group className="mb-2">
				<Form.Label>Sheet name</Form.Label>
				<Form.Control value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
			</Form.Group>
			<Form.Group className="mb-2">
				<Form.Label>Data start row</Form.Label>
				<Form.Control
					type="number"
					min={1}
					value={dataStartRow}
					onChange={(e) => setDataStartRow(e.target.value)}
				/>
			</Form.Group>
			<Form.Group className="mb-2">
				<Form.Label>Credentials env var</Form.Label>
				<Form.Control
					value={credentialsEnvVar}
					onChange={(e) => setCredentialsEnvVar(e.target.value)}
					placeholder="GOOGLE_SHEETS_CREDENTIALS_JSON"
				/>
				<Form.Text className="text-muted">
					Name of an environment variable containing the service-account JSON. Defaults to{' '}
					<code>GOOGLE_SHEETS_CREDENTIALS_JSON</code> when empty.
				</Form.Text>
			</Form.Group>
			<Form.Group className="mb-3">
				<Form.Label>Credentials file path (server)</Form.Label>
				<Form.Control
					value={credentialsPath}
					onChange={(e) => setCredentialsPath(e.target.value)}
					placeholder="/path/to/service-account.json"
				/>
				<Form.Text className="text-muted">
					Optional path on the backend host. <code>GOOGLE_SHEETS_CREDENTIALS_PATH</code> env is
					used when this is empty.
				</Form.Text>
			</Form.Group>
			<Form.Group className="mb-3">
				<Form.Check
					type="switch"
					id="google-sheets-bundled-nrcs-fallback"
					label="Use bundled NRCS fallback when this rundown has no saved NRCS JSON"
					checked={useBundledNrcsFallback}
					onChange={(e) => setUseBundledNrcsFallback(e.target.checked)}
				/>
				<Form.Text className="text-muted">
					Useful for testing the NRCS → Sheets flow without importing NRCS first.
				</Form.Text>
			</Form.Group>

			<div className="d-flex flex-wrap gap-2 align-items-center">
				<Button variant="primary" disabled={saving} onClick={() => void saveSheetsSettings()}>
					{saving ? 'Saving…' : 'Save Google Sheets settings'}
				</Button>
				<Button variant="outline-primary" disabled={testing} onClick={() => void runTest()}>
					{testing ? 'Testing…' : 'Test connection'}
				</Button>
			</div>

			{testMessage && (
				<Alert variant={testVariant} className="mt-2 mb-0 py-2 small">
					{testMessage}
				</Alert>
			)}
		</section>
	)
}
