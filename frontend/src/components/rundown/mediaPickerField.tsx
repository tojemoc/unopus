import { useEffect, useState } from 'react'
import { Form } from 'react-bootstrap'
import { fetchRundownMedia } from '~/lib/mediaApi'
import type { MediaFileEntry } from '~backend/background/interfaces'

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
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		setError(null)

		fetchRundownMedia(rundownId, subdir)
			.then((result) => {
				if (!cancelled) {
					setFiles(result)
				}
			})
			.catch((e) => {
				if (!cancelled) {
					setError((e as Error).message)
					setFiles([])
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false)
				}
			})

		return () => {
			cancelled = true
		}
	}, [rundownId, subdir])

	const hasCurrentValue = Boolean(value)
	const valueInList = files.some((f) => f.path === value)

	return (
		<>
			<Form.Select
				name={name}
				value={value ?? ''}
				onBlur={onBlur}
				onChange={(e) => onChange(e.target.value)}
				disabled={loading}
			>
				<option value="">{loading ? 'Loading clips…' : '— Select clip —'}</option>
				{hasCurrentValue && !valueInList && (
					<option value={value}>{value} (not in folder)</option>
				)}
				{files.map((file) => (
					<option key={file.path} value={file.path}>
						{file.name}
					</option>
				))}
			</Form.Select>
			{error && (
				<Form.Text className="text-warning d-block">
					Could not list media: {error}
				</Form.Text>
			)}
			{!loading && !error && files.length === 0 && (
				<Form.Text className="text-muted d-block">
					No files in spravy/{rundownId}/{subdir}/
				</Form.Text>
			)}
		</>
	)
}
