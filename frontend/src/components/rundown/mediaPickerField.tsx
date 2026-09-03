import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button, Form, InputGroup, Spinner } from 'react-bootstrap'
import {
	ensureRundownMediaFolder,
	fetchAppConfig,
	fetchMediaDurationSeconds,
	fetchRundownMedia
} from '~/lib/mediaApi'
import type { MediaFileEntry } from '~backend/background/interfaces'
import { findNearDuplicateMediaNames, formatSecondsClock } from '~/util/pieceDuration'

const MEDIA_POLL_MS = 10_000

function formatMediaOptionLabel(file: MediaFileEntry): string {
	const readiness = file.readiness ?? 'unknown'
	let statusText = 'not yet confirmed'
	if (readiness === 'confirmed') {
		statusText = 'confirmed'
	} else if (readiness === 'not-confirmed') {
		const reason = file.reason?.trim()
		statusText = reason ? `not confirmed: ${reason}` : 'not confirmed'
	}
	if (file.durationSeconds) {
		return `${file.name} (${formatSecondsClock(file.durationSeconds)}) (${statusText})`
	}
	return `${file.name} (${statusText})`
}

export function MediaPickerField({
	rundownId,
	subdir = 'clips',
	value,
	onChange,
	onBlur,
	name,
	onDurationSeconds
}: {
	rundownId: string
	subdir?: string
	value: string | undefined
	onChange: (value: string) => void
	onBlur: () => void
	name: string
	/** Fired when a clip is selected and ffprobe reports a duration (seconds). */
	onDurationSeconds?: (durationSeconds: number | undefined) => void
}) {
	const [files, setFiles] = useState<MediaFileEntry[]>([])
	const [folderPath, setFolderPath] = useState<string | null>(null)
	const [absoluteFolderPath, setAbsoluteFolderPath] = useState<string | null>(null)
	const [folderExists, setFolderExists] = useState(true)
	const [initialLoading, setInitialLoading] = useState(true)
	const [creatingFolder, setCreatingFolder] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [ingestMediaRoot, setIngestMediaRoot] = useState<string | null>(null)
	const [probing, setProbing] = useState(false)
	const [lastProbeSeconds, setLastProbeSeconds] = useState<number | undefined>(undefined)
	const requestIdRef = useRef(0)
	const durationRequestIdRef = useRef(0)
	const datalistId = useId()

	useEffect(() => {
		let cancelled = false
		fetchAppConfig()
			.then((config) => {
				if (!cancelled) {
					setIngestMediaRoot(config.ingestMediaRoot)
				}
			})
			.catch(() => {
				if (!cancelled) {
					setIngestMediaRoot(null)
				}
			})
		return () => {
			cancelled = true
		}
	}, [])

	const applyListing = useCallback((listing: Awaited<ReturnType<typeof fetchRundownMedia>>) => {
		setFiles(listing.files)
		setFolderPath(listing.folderPath)
		setAbsoluteFolderPath(listing.absoluteFolderPath)
		setFolderExists(listing.folderExists)
		if (listing.ingestMediaRoot) {
			setIngestMediaRoot(listing.ingestMediaRoot)
		}
	}, [])

	const loadMedia = useCallback(
		async (options?: { showInitialLoading?: boolean }) => {
			const requestId = ++requestIdRef.current
			const showInitialLoading = options?.showInitialLoading ?? false

			if (showInitialLoading) {
				setInitialLoading(true)
			}
			setError(null)

			try {
				const listing = await fetchRundownMedia(rundownId, subdir)
				if (requestId !== requestIdRef.current) {
					return
				}

				applyListing(listing)
			} catch (e) {
				if (requestId !== requestIdRef.current) {
					return
				}

				setError((e as Error).message)
				setFiles([])
			} finally {
				if (requestId === requestIdRef.current && showInitialLoading) {
					setInitialLoading(false)
				}
			}
		},
		[applyListing, rundownId, subdir]
	)

	useEffect(() => {
		void loadMedia({ showInitialLoading: true })
		const interval = window.setInterval(() => {
			void loadMedia()
		}, MEDIA_POLL_MS)

		return () => {
			requestIdRef.current += 1
			window.clearInterval(interval)
		}
	}, [loadMedia])

	const emitDurationForPath = useCallback(
		async (mediaPath: string, _knownSeconds?: number, forceProbe = false) => {
			if (!onDurationSeconds) {
				return
			}
			const requestId = ++durationRequestIdRef.current
			if (!mediaPath.trim()) {
				setLastProbeSeconds(undefined)
				setProbing(false)
				onDurationSeconds(undefined)
				return
			}

			// Always re-run ffprobe on explicit picks so Source length updates visibly
			// (listing cache can be stale after a file replace).
			if (!forceProbe && typeof _knownSeconds === 'number' && Number.isFinite(_knownSeconds) && _knownSeconds > 0) {
				// Kept for blur-without-change paths that only need a soft fill.
			}

			setProbing(true)
			try {
				const seconds = await fetchMediaDurationSeconds(mediaPath.trim())
				if (requestId !== durationRequestIdRef.current) {
					return
				}
				setLastProbeSeconds(seconds)
				onDurationSeconds(seconds)
			} catch {
				if (requestId !== durationRequestIdRef.current) {
					return
				}
				setLastProbeSeconds(undefined)
				onDurationSeconds(undefined)
			} finally {
				if (requestId === durationRequestIdRef.current) {
					setProbing(false)
				}
			}
		},
		[onDurationSeconds]
	)

	const handlePathChange = useCallback(
		(nextPath: string, knownSeconds?: number, probeNow = false) => {
			onChange(nextPath)
			if (probeNow) {
				void emitDurationForPath(nextPath, knownSeconds, true)
			} else if (typeof knownSeconds === 'number') {
				void emitDurationForPath(nextPath, knownSeconds, false)
			}
		},
		[emitDurationForPath, onChange]
	)

	const handleCreateFolder = useCallback(async () => {
		setCreatingFolder(true)
		setError(null)
		try {
			const listing = await ensureRundownMediaFolder(rundownId, subdir)
			applyListing(listing)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setCreatingFolder(false)
		}
	}, [applyListing, rundownId, subdir])

	const logicalFolderPath = folderPath ?? subdir
	const absolutePath =
		absoluteFolderPath ??
		(ingestMediaRoot ? `${ingestMediaRoot.replace(/[/\\]+$/, '')}/${logicalFolderPath}` : null)

	const nearDuplicates =
		value && value.trim()
			? findNearDuplicateMediaNames(
					value.trim(),
					files.map((f) => f.path)
				)
			: []

	return (
		<>
			<InputGroup>
				<Form.Control
					name={name}
					list={datalistId}
					value={value ?? ''}
					placeholder={`e.g. ${subdir}/clip.mp4`}
					disabled={initialLoading}
					onBlur={() => {
						onBlur()
						void emitDurationForPath(value ?? '', undefined, true)
					}}
					onChange={(e) => handlePathChange(e.target.value.trimStart())}
					autoComplete="off"
				/>
				<Button
					type="button"
					variant="outline-secondary"
					onClick={() => void loadMedia({ showInitialLoading: true })}
					disabled={initialLoading}
				>
					Refresh
				</Button>
			</InputGroup>
			<datalist id={datalistId}>
				{files.map((file) => (
					<option
						key={file.path}
						value={file.path}
						label={formatMediaOptionLabel(file)}
					>
						{formatMediaOptionLabel(file)}
					</option>
				))}
			</datalist>
			{files.length > 0 && (
				<Form.Select
					className="mt-2"
					aria-label="Pick a scanned clip"
					value={files.some((f) => f.path === value) ? (value ?? '') : ''}
					onBlur={onBlur}
					onChange={(e) => {
						const selected = files.find((f) => f.path === e.target.value)
						handlePathChange(e.target.value, selected?.durationSeconds, true)
					}}
				>
					<option value="">— Or pick from scanned folder —</option>
					{files.map((file) => (
						<option key={file.path} value={file.path}>
							{formatMediaOptionLabel(file)}
						</option>
					))}
				</Form.Select>
			)}
			{onDurationSeconds ? (
				<Form.Text className="d-block mt-1">
					{probing ? (
						<span className="text-primary">
							<Spinner animation="border" size="sm" className="me-1" />
							Probing media duration…
						</span>
					) : typeof lastProbeSeconds === 'number' ? (
						<span className="text-success">
							Source length: {formatSecondsClock(lastProbeSeconds)} ({lastProbeSeconds}s)
						</span>
					) : value?.trim() ? (
						<span className="text-muted">Pick a clip to measure Source length</span>
					) : null}
				</Form.Text>
			) : null}
			{nearDuplicates.length > 0 ? (
				<Form.Text className="text-warning d-block mt-1">
					Near-duplicate filename(s) in this folder — confirm the on-air pick:{' '}
					{nearDuplicates.map((p) => p.split(/[/\\]/).pop()).join(', ')}
				</Form.Text>
			) : null}
			{error && (
				<Form.Text className="text-warning d-block">
					Could not list media: {error}
				</Form.Text>
			)}
			{!initialLoading && !error && !folderExists && (
				<>
					<Form.Text className="text-muted d-block">
						Scan folder not found
						{absolutePath ? (
							<>
								:{' '}
								<code className="user-select-all">{absolutePath}</code>
							</>
						) : (
							<>
								{' '}
								at <code>{logicalFolderPath}</code>
							</>
						)}
						. Paths are relative to the ingest root (same tree Sofie Package Manager uses). You can
						still type a path above.
					</Form.Text>
					<Button
						type="button"
						variant="outline-primary"
						size="sm"
						className="mt-1"
						disabled={creatingFolder}
						onClick={() => void handleCreateFolder()}
					>
						{creatingFolder ? 'Creating…' : 'Create scan folder'}
					</Button>
				</>
			)}
			{!initialLoading && !error && folderExists && files.length === 0 && (
				<Form.Text className="text-muted d-block">
					No files in <code className="user-select-all">{absolutePath ?? logicalFolderPath}</code>{' '}
					yet — type a path relative to the ingest/Caspar media root, or drop files into that
					folder.
				</Form.Text>
			)}
			{ingestMediaRoot && (
				<Form.Text className="text-muted d-block">
					Ingest root: <code className="user-select-all">{ingestMediaRoot}</code>
					{folderExists && absolutePath ? (
						<>
							{' '}
							· scan: <code className="user-select-all">{absolutePath}</code>
						</>
					) : null}
				</Form.Text>
			)}
		</>
	)
}
