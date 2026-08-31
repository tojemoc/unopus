import { useMemo } from 'react'

export function ClipPreview({ clipPath }: { clipPath: string | undefined }) {
	const src = useMemo(() => {
		if (!clipPath?.trim()) {
			return null
		}
		return `/api/media/file?path=${encodeURIComponent(clipPath.trim())}`
	}, [clipPath])

	if (!src) {
		return null
	}

	return (
		<div className="clip-preview mb-3">
			<h3 className="mb-2">Clip Preview</h3>
			<div className="clip-preview-frame">
				<video src={src} controls preload="metadata" playsInline />
			</div>
		</div>
	)
}
