import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Badge, Form } from 'react-bootstrap'
import { BsExclamationTriangle } from 'react-icons/bs'

export interface MediaClipOption {
	id: string
	name: string
	path?: string
}

type MediaClipsSource = 'core' | 'history'

interface MediaClipsResponse {
	clips: MediaClipOption[]
	source: MediaClipsSource
}

const apiBase = import.meta.env.MODE === 'development' ? '' : ''

export function MediaClipPicker({
	value,
	onChange,
	onBlur,
	disabled,
	name
}: {
	value: string
	onChange: (value: string) => void
	onBlur?: () => void
	disabled?: boolean
	name?: string
}) {
	const listId = useId()
	const [clips, setClips] = useState<MediaClipOption[]>([])
	const [source, setSource] = useState<MediaClipsSource | null>(null)
	const [fetchFailed, setFetchFailed] = useState(false)
	const [loading, setLoading] = useState(false)
	const loadedRef = useRef(false)

	const loadClips = useCallback(async () => {
		setLoading(true)
		try {
			const response = await fetch(`${apiBase}/api/media/clips`, {
				credentials: 'include'
			})
			if (!response.ok) {
				throw new Error('Failed to load media clips')
			}
			const data = (await response.json()) as MediaClipsResponse
			setClips(data.clips)
			setSource(data.source)
			setFetchFailed(false)
			loadedRef.current = true
		} catch {
			setFetchFailed(true)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void loadClips()
	}, [loadClips])

	const handleFocus = () => {
		if (!loadedRef.current && !loading) {
			void loadClips()
		}
	}

	const normalizedQuery = value.trim().toLowerCase()
	const matchingClips =
		normalizedQuery.length === 0
			? clips
			: clips.filter(
					(clip) =>
						clip.name.toLowerCase().includes(normalizedQuery) ||
						(clip.path?.toLowerCase().includes(normalizedQuery) ?? false)
				)

	return (
		<div>
			<div className="d-flex align-items-center gap-2 mb-1">
				{source !== null && !fetchFailed && (
					<Badge bg={source === 'core' ? 'primary' : 'secondary'} className="text-uppercase">
						{source === 'core' ? 'from Core' : 'from history'}
					</Badge>
				)}
				{fetchFailed && (
					<span
						className="text-warning d-inline-flex align-items-center gap-1 small"
						title="Could not load media list"
					>
						<BsExclamationTriangle aria-hidden />
						List unavailable
					</span>
				)}
			</div>
			<Form.Control
				name={name}
				type="text"
				list={fetchFailed ? undefined : listId}
				value={value}
				disabled={disabled}
				onFocus={handleFocus}
				onBlur={onBlur}
				onChange={(e) => onChange(e.target.value)}
			/>
			{!fetchFailed && (
				<datalist id={listId}>
					{matchingClips.map((clip) => (
						<option key={clip.id} value={clip.name} label={clip.path} />
					))}
				</datalist>
			)}
		</div>
	)
}
