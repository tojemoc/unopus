import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button, Form, InputGroup } from 'react-bootstrap'
import { ensureRundownMediaFolder, fetchAppConfig, fetchRundownMedia } from '~/lib/mediaApi'
import type { MediaFileEntry } from '~backend/background/interfaces'

const MEDIA_POLL_MS = 10_000

export function MediaPickerField({
	rundownId,
	subdir = 'clips',
	value,
	onChange,
	onBlur,
	name
}: {
	rundownId: string
	subdir?: string
	value: string | undefined
	onChange: (value: string) => void
	onBlur: () => void
	name: string
}) {
	const [files, setFiles] = useState<MediaFileEntry[]>([])
	const [folderPath, setFolderPath] = useState<string | null>(null)
	const [absoluteFolderPath, setAbsoluteFolderPath] = useState<string | null>(null)
	const [folderExists, setFolderExists] = useState(true)
	const [initialLoading, setInitialLoading] = useState(true)
	const [creatingFolder, setCreatingFolder] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [ingestMediaRoot, setIngestMediaRoot] = useState<string | null>(null)
	const requestIdRef = useRef(0)
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

	const applyListing = useCallback(
		(listing: Awaited<ReturnType<typeof fetchRundownMedia>>) => {
			setFiles(listing.files)
			setFolderPath(listing.folderPath)
			setAbsoluteFolderPath(listing.absoluteFolderPath)
			setFolderExists(listing.folderExists)
			if (listing.ingestMediaRoot) {
				setIngestMediaRoot(listing.ingestMediaRoot)
			}
		},
		[]
	)

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

	const logicalFolderPath = folderPath ?? `spravy/${rundownId}/${subdir}`
	const absolutePath =
		absoluteFolderPath ??
		(ingestMediaRoot ? `${ingestMediaRoot.replace(/[/\\]+$/, '')}/${logicalFolderPath}` : null)

	return (
		<>
			<InputGroup>
				<Form.Control
					name={name}
					list={datalistId}
					value={value ?? ''}
					placeholder="e.g. spravy/my-rundown/clips/clip.mp4"
					disabled={initialLoading}
					onBlur={onBlur}
					onChange={(e) => onChange(e.target.value.trimStart())}
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
					<option key={file.path} value={file.path}>
						{file.name}
					</option>
				))}
			</datalist>
			{files.length > 0 && (
				<Form.Select
					className="mt-2"
					aria-label="Pick a scanned clip"
					value={files.some((f) => f.path === value) ? (value ?? '') : ''}
					onBlur={onBlur}
					onChange={(e) => onChange(e.target.value)}
				>
					<option value="">— Or pick from scanned folder —</option>
					{files.map((file) => (
						<option key={file.path} value={file.path}>
							{file.name}
						</option>
					))}
				</Form.Select>
			)}
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
						. Paths are relative to the ingest root (same tree Softie Package Manager uses). You can
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
