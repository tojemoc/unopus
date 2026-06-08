import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Modal, Spinner } from 'react-bootstrap'
import { Link } from '@tanstack/react-router'
import { useToasts } from '~/components/toasts/useToasts'
import {
	fetchGoogleSheetsStatus,
	previewRundownSheetRows,
	pullRundownFromGoogleSheets,
	syncRundownEditorToGoogleSheets,
	type GoogleSheetsStatus
} from '~/lib/googleSheetsApi'

interface GoogleSheetsSyncModalProps {
	rundownId: string
	show: boolean
	onHide: () => void
}

export function GoogleSheetsSyncModal({ rundownId, show, onHide }: GoogleSheetsSyncModalProps) {
	const toasts = useToasts()
	const [status, setStatus] = useState<GoogleSheetsStatus | null>(null)
	const [loadingStatus, setLoadingStatus] = useState(false)
	const [previewRowCount, setPreviewRowCount] = useState<number | null>(null)
	const [previewError, setPreviewError] = useState<string | null>(null)
	const [syncing, setSyncing] = useState(false)
	const [pulling, setPulling] = useState(false)
	const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)
	const [lastSyncVariant, setLastSyncVariant] = useState<'success' | 'danger'>('success')

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
	}, [show, refreshStatus])

	const previewRequestId = useRef(0)

	useEffect(() => {
		if (!show) {
			setPreviewRowCount(null)
			setPreviewError(null)
			return
		}

		const handle = window.setTimeout(() => {
			const requestId = ++previewRequestId.current
			void previewRundownSheetRows(rundownId)
				.then((result) => {
					if (requestId !== previewRequestId.current) return
					setPreviewRowCount(result.rowCount)
					setPreviewError(null)
				})
				.catch((e) => {
					if (requestId !== previewRequestId.current) return
					setPreviewRowCount(null)
					setPreviewError(e instanceof Error ? e.message : 'Preview failed')
				})
		}, 300)

		return () => {
			window.clearTimeout(handle)
			previewRequestId.current += 1
		}
	}, [rundownId, show])

	const handlePushResult = (result: Awaited<ReturnType<typeof syncRundownEditorToGoogleSheets>>) => {
		if (!result.ok || result.error || !result.sheetWrite) {
			const message = result.error ?? 'Push did not complete — no rows were written to Google Sheets'
			setLastSyncVariant('danger')
			setLastSyncMessage(message)
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: message,
				color: 'danger'
			})
			return
		}
		const range = result.sheetWrite.updatedRange
		setLastSyncVariant('success')
		setLastSyncMessage(
			`Pushed ${result.rowCount} row${result.rowCount === 1 ? '' : 's'} to Google Sheets` +
				(range ? ` (${range})` : '')
		)
		toasts.show({
			headerContent: 'Google Sheets',
			bodyContent: `Synced ${result.rowCount} rows`,
			color: 'success'
		})
	}

	const runPush = async () => {
		setSyncing(true)
		setLastSyncMessage(null)
		try {
			handlePushResult(await syncRundownEditorToGoogleSheets(rundownId))
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Push failed'
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

	const runPull = async () => {
		setPulling(true)
		setLastSyncMessage(null)
		try {
			const result = await pullRundownFromGoogleSheets(rundownId)
			if (!result.ok) {
				throw new Error(result.error ?? 'Pull failed')
			}
			const summary =
				`Pulled from ${result.sheetRowCount} sheet row${result.sheetRowCount === 1 ? '' : 's'}: ` +
				`${result.updatedPieces} piece${result.updatedPieces === 1 ? '' : 's'} updated` +
				(result.createdPieces > 0
					? `, ${result.createdPieces} piece${result.createdPieces === 1 ? '' : 's'} created`
					: '') +
				(result.updatedParts > 0
					? `, ${result.updatedParts} part script${result.updatedParts === 1 ? '' : 's'} updated`
					: '')
			setLastSyncVariant('success')
			setLastSyncMessage(summary)
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: summary,
				color: 'success'
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Pull failed'
			setLastSyncVariant('danger')
			setLastSyncMessage(message)
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: message,
				color: 'danger'
			})
		} finally {
			setPulling(false)
		}
	}

	const configured = status?.configured ?? false
	const trimmedPreviewError = previewError?.trim() || null
	const busy = syncing || pulling

	return (
		<Modal show={show} onHide={onHide} size="lg" centered>
			<Modal.Header closeButton>
				<Modal.Title>Google Sheets</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Alert variant="info" className="py-2 small">
					Bridge to your existing <strong>Google Sheets + Companion + vMix</strong> grid. Rundown
					Editor is the source of truth for stories; push writes the same columns (C–K) your show
					already uses. When you are on Sofie-only, you will not need this step.
				</Alert>
				<p className="text-muted small mb-0">
					<strong>Push</strong> — full rundown → sheet (segment order, transitions, playout cues, plus
					mapped piece fields). <strong>Pull</strong> — only fields you configured under Settings →
					mappings (e.g. headline title/subtitle from E/F).
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
								spreadsheet ID, credentials, and column mappings.
							</>
						)}
					</Alert>
				)}

				{trimmedPreviewError ? (
					<Alert variant="danger" className="py-2 small mt-3">
						{trimmedPreviewError}
					</Alert>
				) : previewRowCount !== null ? (
					<Alert variant="info" className="py-2 small mt-3">
						{previewRowCount} row{previewRowCount === 1 ? '' : 's'} will be pushed from this rundown.
					</Alert>
				) : null}

				{lastSyncMessage && (
					<Alert variant={lastSyncVariant} className="mt-3 mb-0 py-2 small">
						{lastSyncMessage}
					</Alert>
				)}
			</Modal.Body>
			<Modal.Footer>
				<Button variant="secondary" onClick={onHide} disabled={busy}>
					Close
				</Button>
				<Button
					variant="outline-secondary"
					disabled={!configured || busy}
					onClick={() => void runPull()}
				>
					{pulling ? 'Pulling…' : 'Pull from Google Sheets'}
				</Button>
				<Button variant="primary" disabled={!configured || busy || previewError !== null} onClick={() => void runPush()}>
					{syncing ? 'Pushing…' : 'Push to Google Sheets'}
				</Button>
			</Modal.Footer>
		</Modal>
	)
}
