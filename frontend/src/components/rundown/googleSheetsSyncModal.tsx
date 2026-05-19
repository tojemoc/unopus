import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'
import { Link } from '@tanstack/react-router'
import { DropImportZone } from '~/components/files/dropImportZone'
import { useToasts } from '~/components/toasts/useToasts'
import {
	fetchGoogleSheetsStatus,
	nrcsLocalStorageKey,
	previewNrcsSheetRows,
	syncRundownToGoogleSheets,
	type GoogleSheetsStatus
} from '~/lib/googleSheetsApi'

interface GoogleSheetsSyncModalProps {
	rundownId: string
	show: boolean
	onHide: () => void
}

function parseNrcsJson(text: string): unknown {
	const parsed: unknown = JSON.parse(text)
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('NRCS JSON must be an object')
	}
	return parsed
}

export function GoogleSheetsSyncModal({ rundownId, show, onHide }: GoogleSheetsSyncModalProps) {
	const toasts = useToasts()
	const [status, setStatus] = useState<GoogleSheetsStatus | null>(null)
	const [loadingStatus, setLoadingStatus] = useState(false)
	const [nrcsText, setNrcsText] = useState('')
	const [previewRowCount, setPreviewRowCount] = useState<number | null>(null)
	const [previewError, setPreviewError] = useState<string | null>(null)
	const [syncing, setSyncing] = useState(false)
	const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)
	const [lastSyncVariant, setLastSyncVariant] = useState<'success' | 'danger'>('success')

	const storageKey = useMemo(() => nrcsLocalStorageKey(rundownId), [rundownId])

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
		if (!show) return
		void refreshStatus()
		try {
			const saved = localStorage.getItem(storageKey)
			if (saved) setNrcsText(saved)
		} catch {
			// ignore storage errors
		}
	}, [show, refreshStatus, storageKey])

	useEffect(() => {
		if (!show || !nrcsText.trim()) {
			setPreviewRowCount(null)
			setPreviewError(null)
			return
		}

		const handle = window.setTimeout(() => {
			try {
				const nrcs = parseNrcsJson(nrcsText)
				void previewNrcsSheetRows(nrcs)
					.then((result) => {
						setPreviewRowCount(result.rows.length)
						setPreviewError(null)
					})
					.catch((e) => {
						setPreviewRowCount(null)
						setPreviewError(e instanceof Error ? e.message : 'Preview failed')
					})
			} catch (e) {
				setPreviewRowCount(null)
				setPreviewError(e instanceof Error ? e.message : 'Invalid JSON')
			}
		}, 400)

		return () => window.clearTimeout(handle)
	}, [nrcsText, show])

	const loadNrcsFile = async (file: File) => {
		const text = await file.text()
		parseNrcsJson(text)
		setNrcsText(text)
		setLastSyncMessage(null)
	}

	const persistNrcs = (text: string) => {
		try {
			localStorage.setItem(storageKey, text)
		} catch {
			// ignore
		}
	}

	const runSync = async () => {
		setSyncing(true)
		setLastSyncMessage(null)
		try {
			const nrcs = parseNrcsJson(nrcsText)
			persistNrcs(nrcsText)
			const result = await syncRundownToGoogleSheets(rundownId, nrcs)
			const range = result.sheetWrite?.updatedRange
			setLastSyncVariant('success')
			setLastSyncMessage(
				`Wrote ${result.rowCount} row${result.rowCount === 1 ? '' : 's'} to Google Sheets` +
					(range ? ` (${range})` : '') +
					'. Lower-third timing was merged from this rundown where parts matched.'
			)
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: `Synced ${result.rowCount} rows`,
				color: 'success'
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Sync failed'
			setLastSyncVariant('danger')
			setLastSyncMessage(message)
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: message,
				color: 'danger'
			})
		} finally {
			setSyncing(false)
		}
	}

	const configured = status?.configured ?? false
	const canSync = configured && nrcsText.trim().length > 0 && previewError === null && previewRowCount !== null

	return (
		<Modal show={show} onHide={onHide} size="lg" centered>
			<Modal.Header closeButton>
				<Modal.Title>Sync to Google Sheets</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<p className="text-muted small">
					Push NRCS rundown data to your vMix automation spreadsheet. Rows are mapped from the
					NRCS JSON; columns L/M are filled from lower-third pieces in this rundown when block and
					headline match a part.
				</p>

				{loadingStatus ? (
					<Spinner animation="border" size="sm" className="mb-3" />
				) : (
					<Alert variant={configured ? 'success' : 'warning'} className="py-2 small">
						{configured ? (
							<>
								Connected — spreadsheet{' '}
								<code className="user-select-all">{status?.spreadsheetId ?? '—'}</code>
								{status?.sheetName ? (
									<>
										, sheet <strong>{status.sheetName}</strong>
									</>
								) : null}
								, data from row {status?.dataStartRow ?? 2}.
							</>
						) : (
							<>
								Google Sheets is not configured.{' '}
								<Link to="/settings/connection">Open connection settings</Link> to set the
								spreadsheet ID and credentials.
							</>
						)}
					</Alert>
				)}

				<DropImportZone
					label="NRCS rundown JSON"
					accept=".json,application/json"
					onFile={loadNrcsFile}
				/>

				<Form.Group className="mt-3">
					<Form.Label>NRCS JSON</Form.Label>
					<Form.Control
						as="textarea"
						rows={10}
						value={nrcsText}
						onChange={(e) => {
							setNrcsText(e.target.value)
							setLastSyncMessage(null)
						}}
						placeholder='Paste NRCS export JSON (e.g. main_topics, headlines, …)'
						className="font-monospace small"
						spellCheck={false}
					/>
					{previewError && (
						<Form.Text className="text-danger">{previewError}</Form.Text>
					)}
					{!previewError && previewRowCount !== null && (
						<Form.Text className="text-muted">
							{previewRowCount} sheet row{previewRowCount === 1 ? '' : 's'} ready to sync.
						</Form.Text>
					)}
				</Form.Group>

				{lastSyncMessage && (
					<Alert variant={lastSyncVariant} className="mt-3 mb-0 py-2 small">
						{lastSyncMessage}
					</Alert>
				)}
			</Modal.Body>
			<Modal.Footer>
				<Button variant="secondary" onClick={onHide} disabled={syncing}>
					Close
				</Button>
				<Button variant="primary" disabled={!canSync || syncing} onClick={() => void runSync()}>
					{syncing ? 'Syncing…' : 'Sync to Google Sheets'}
				</Button>
			</Modal.Footer>
		</Modal>
	)
}
