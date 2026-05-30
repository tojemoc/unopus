import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Modal, Spinner } from 'react-bootstrap'
import { Link } from '@tanstack/react-router'
import { useToasts } from '~/components/toasts/useToasts'
import { useAppSelector } from '~/store/app'
import { defaultNrcsRundownText } from '~/lib/defaultNrcsRundown'
import {
	fetchGoogleSheetsStatus,
	nrcsLocalStorageKey,
	previewNrcsSheetRows,
	syncRundownEditorToGoogleSheets,
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
	const settings = useAppSelector((state) => state.settings.settings)
	const [status, setStatus] = useState<GoogleSheetsStatus | null>(null)
	const [loadingStatus, setLoadingStatus] = useState(false)
	const [nrcsText, setNrcsText] = useState('')
	const [previewRowCount, setPreviewRowCount] = useState<number | null>(null)
	const [previewError, setPreviewError] = useState<string | null>(null)
	const [syncing, setSyncing] = useState(false)
	const [syncingFromRundown, setSyncingFromRundown] = useState(false)
	const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)
	const [lastSyncVariant, setLastSyncVariant] = useState<'success' | 'danger'>('success')
	const [loadedFromFallback, setLoadedFromFallback] = useState(false)

	const storageKey = useMemo(() => nrcsLocalStorageKey(rundownId), [rundownId])
	const useBundledFallback = settings?.googleSheetsUseBundledNrcsFallback ?? false

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
			if (saved && saved.trim().length > 0) {
				setNrcsText(saved)
				setLoadedFromFallback(false)
			} else {
				setNrcsText(useBundledFallback ? defaultNrcsRundownText : '')
				setLoadedFromFallback(useBundledFallback)
			}
		} catch {
			// ignore storage errors
			setNrcsText(useBundledFallback ? defaultNrcsRundownText : '')
			setLoadedFromFallback(useBundledFallback)
		}
	}, [show, refreshStatus, storageKey, useBundledFallback])

	const previewRequestId = useRef(0)

	useEffect(() => {
		if (!show || !nrcsText.trim()) {
			setPreviewRowCount(null)
			setPreviewError(null)
			return
		}

		const handle = window.setTimeout(() => {
			const requestId = ++previewRequestId.current
			try {
				const nrcs = parseNrcsJson(nrcsText)
				void previewNrcsSheetRows(nrcs)
					.then((result) => {
						if (requestId !== previewRequestId.current) return
						setPreviewRowCount(result.rows.length)
						setPreviewError(null)
					})
					.catch((e) => {
						if (requestId !== previewRequestId.current) return
						setPreviewRowCount(null)
						setPreviewError(e instanceof Error ? e.message : 'Preview failed')
					})
			} catch (e) {
				if (requestId !== previewRequestId.current) return
				setPreviewRowCount(null)
				setPreviewError(e instanceof Error ? e.message : 'Invalid JSON')
			}
		}, 400)

		return () => {
			window.clearTimeout(handle)
			previewRequestId.current += 1
		}
	}, [nrcsText, show])

	const handleSyncResult = (result: Awaited<ReturnType<typeof syncRundownToGoogleSheets>>, source: string) => {
		if (!result.ok || result.error || !result.sheetWrite) {
			const message = result.error ?? 'Sync did not complete — no rows were written to Google Sheets'
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
			`${source}: wrote ${result.rowCount} row${result.rowCount === 1 ? '' : 's'} to Google Sheets` +
				(range ? ` (${range})` : '') +
				(source === 'Push from NRCS JSON'
					? '. Lower-third timing was merged from this rundown where parts matched.'
					: '.')
		)
		toasts.show({
			headerContent: 'Google Sheets',
			bodyContent: `Synced ${result.rowCount} rows`,
			color: 'success'
		})
	}

	const runSync = async () => {
		setSyncing(true)
		setLastSyncMessage(null)
		try {
			const nrcs = parseNrcsJson(nrcsText)
			handleSyncResult(await syncRundownToGoogleSheets(rundownId, nrcs), 'Push from NRCS JSON')
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

	const runSyncFromRundown = async () => {
		setSyncingFromRundown(true)
		setLastSyncMessage(null)
		try {
			handleSyncResult(
				await syncRundownEditorToGoogleSheets(rundownId),
				'Push from Rundown Editor'
			)
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
			setSyncingFromRundown(false)
		}
	}

	const configured = status?.configured ?? false
	const hasSavedNrcs = nrcsText.trim().length > 0
	const trimmedPreviewError = previewError?.trim() || null
	const canSync = configured && nrcsText.trim().length > 0 && previewError === null && previewRowCount !== null

	return (
		<Modal show={show} onHide={onHide} size="lg" centered>
			<Modal.Header closeButton>
				<Modal.Title>Sync to Google Sheets</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<p className="text-muted small">
					Push to your vMix automation spreadsheet. Use <strong>Push from Rundown Editor</strong> to
					map segments, parts, and pieces already in this rundown, or <strong>Push from NRCS JSON</strong>{' '}
					for the legacy NRCS import path (columns L/M merge lower-thirds when block and headline
					match a part).
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

				{loadedFromFallback && hasSavedNrcs && (
					<Alert variant="info" className="py-2 small mt-3">
						Using bundled NRCS fallback from Settings because this rundown has no saved NRCS JSON.
					</Alert>
				)}

				{!hasSavedNrcs ? (
					<Alert variant="warning" className="py-2 small mt-3">
						No valid NRCS JSON is saved for this rundown yet. Import and sync a rundown once to
						store NRCS data, then push to Google Sheets from here.
					</Alert>
				) : trimmedPreviewError ? (
					<Alert variant="danger" className="py-2 small mt-3">
						{trimmedPreviewError}
					</Alert>
				) : previewRowCount !== null ? (
					<Alert variant="info" className="py-2 small mt-3">
						{previewRowCount} sheet row{previewRowCount === 1 ? '' : 's'} ready to push.
					</Alert>
				) : null}

				{lastSyncMessage && (
					<Alert variant={lastSyncVariant} className="mt-3 mb-0 py-2 small">
						{lastSyncMessage}
					</Alert>
				)}
			</Modal.Body>
			<Modal.Footer>
				<Button variant="secondary" onClick={onHide} disabled={syncing || syncingFromRundown}>
					Close
				</Button>
				<Button
					variant="outline-primary"
					disabled={!configured || syncing || syncingFromRundown}
					onClick={() => void runSyncFromRundown()}
				>
					{syncingFromRundown ? 'Pushing…' : 'Push from Rundown Editor'}
				</Button>
				<Button variant="primary" disabled={!canSync || syncing || syncingFromRundown} onClick={() => void runSync()}>
					{syncing ? 'Pushing…' : 'Push from NRCS JSON'}
				</Button>
			</Modal.Footer>
		</Modal>
	)
}
