import { useEffect, useMemo, useState } from 'react'
import { fetchPreviewBaseUrl } from '~/lib/mediaApi'
import type { Piece, TypeManifest } from '~backend/background/interfaces'
import { resolveSourceEnabled, trimSourceText } from '~/util/sourcePayload'

function buildPreviewUrl(
	baseUrl: string,
	template: string,
	payload: Record<string, unknown>
): string {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(payload)) {
		if (value === undefined || value === null || value === '') {
			continue
		}
		params.set(key, String(value))
	}
	const query = params.toString()
	return `${baseUrl}/${template}/index.html${query ? `?${query}` : ''}`
}

export function GfxPreview({
	piece,
	manifest,
	payload
}: {
	piece: Piece
	manifest: TypeManifest | undefined
	payload: Record<string, unknown>
}) {
	const [previewBaseUrl, setPreviewBaseUrl] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const template = manifest?.previewTemplate

	useEffect(() => {
		if (!template) {
			return
		}
		let cancelled = false
		fetchPreviewBaseUrl()
			.then((url) => {
				if (!cancelled) {
					setPreviewBaseUrl(url)
				}
			})
			.catch((e) => {
				if (!cancelled) {
					setError((e as Error).message)
				}
			})
		return () => {
			cancelled = true
		}
	}, [template])

	const previewUrl = useMemo(() => {
		if (!previewBaseUrl || !template) {
			return null
		}
		const previewPayload = { ...payload }
		delete previewPayload.sourceEnabled
		delete previewPayload.iluFallback

		const sourceText = trimSourceText(payload.source)
		const sourceEnabled = resolveSourceEnabled(payload.sourceEnabled, sourceText)

		if (!sourceEnabled || !sourceText) {
			delete previewPayload.source
		}

		return buildPreviewUrl(previewBaseUrl, template, previewPayload)
	}, [previewBaseUrl, template, payload])

	if (!template) {
		return null
	}

	return (
		<div className="gfx-preview mb-3">
			<h3 className="mb-2">GFX Preview</h3>
			{error && <div className="text-warning small mb-2">Preview unavailable: {error}</div>}
			{previewUrl ? (
				<div className="gfx-preview-frame">
					<iframe
						key={previewUrl}
						title={`GFX preview for ${piece.name}`}
						src={previewUrl}
						style={{
							position: 'absolute',
							inset: 0,
							width: '100%',
							height: '100%',
							border: 'none'
						}}
					/>
				</div>
			) : (
				<div className="text-muted small">Loading preview…</div>
			)}
		</div>
	)
}
