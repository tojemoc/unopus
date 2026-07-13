import { useCallback, useEffect, useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import { fetchAppConfig, fetchRundownMedia } from '~/lib/mediaApi'
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
	const [folderExists, setFolderExists] = useState(true)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [ingestMediaRoot, setIngestMediaRoot] = useState<string | null>(null)

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

	const loadMedia = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const listing = await fetchRundownMedia(rundownId, subdir)
			setFiles(listing.files)
			setFolderPath(listing.folderPath)
			setFolderExists(listing.folderExists)
		} catch (e) {
			setError((e as Error).message)
			setFiles([])
		} finally {
			setLoading(false)
		}
	}, [rundownId, subdir])

	useEffect(() => {
		void loadMedia()
		const interval = window.setInterval(() => {
			void loadMedia()
		}, MEDIA_POLL_MS)

		return () => {
			window.clearInterval(interval)
		}
	}, [loadMedia])

	const hasCurrentValue = Boolean(value)
	const valueInList = files.some((f) => f.path === value)

	return (
		<>
			<div className="d-flex gap-2 align-items-start">
				<Form.Select
					className="flex-grow-1"
					name={name}
					value={value ?? ''}
					onBlur={onBlur}
					onChange={(e) => onChange(e.target.value)}
					disabled={loading}
				>
					<option value="">{loading ? 'Loading clips…' : '— Select clip —'}</option>
					{hasCurrentValue && !valueInList && (
						<option value={value}>{value} (assigned — not listed in folder)</option>
					)}
					{files.map((file) => (
						<option key={file.path} value={file.path}>
							{file.name}
						</option>
					))}
				</Form.Select>
				<Button type="button" variant="outline-secondary" size="sm" onClick={() => void loadMedia()}>
					Refresh
				</Button>
			</div>
			{error && (
				<Form.Text className="text-warning d-block">
					Could not list media: {error}
				</Form.Text>
			)}
			{!loading && !error && !folderExists && (
				<Form.Text className="text-muted d-block">
					Ingest folder not found at {folderPath ?? `spravy/${rundownId}/${subdir}/`}. Create it or
					check Settings → Ingest media root.
				</Form.Text>
			)}
			{!loading && !error && folderExists && files.length === 0 && (
				<Form.Text className="text-muted d-block">
					No files in {folderPath ?? `spravy/${rundownId}/${subdir}/`} yet.
				</Form.Text>
			)}
			{ingestMediaRoot && (
				<Form.Text className="text-muted d-block">
					Ingest root: {ingestMediaRoot}
				</Form.Text>
			)}
		</>
	)
}
