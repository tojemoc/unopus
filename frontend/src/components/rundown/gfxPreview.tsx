import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	buildCasparBridgePreviewUrl,
	buildCasparTemplateDataXml,
	buildQueryPreviewUrl,
	fetchGfxTemplateResolution,
	isSameOriginPreviewBase,
	joinPreviewPath,
	type GfxTemplateResolution
} from '~/lib/gfxPreview'
import { fetchPreviewBaseUrl } from '~/lib/mediaApi'
import type { Piece, TypeManifest } from '~backend/background/interfaces'
import { resolveSourceEnabled, trimSourceText } from '~/util/sourcePayload'

const GFX_PREVIEW_MESSAGE = 'sofie-gfx-preview'
const GFX_PREVIEW_READY = 'sofie-gfx-preview-ready'

function buildPreviewPayload(payload: Record<string, unknown>): Record<string, unknown> {
	const previewPayload = { ...payload }
	delete previewPayload.sourceEnabled
	delete previewPayload.iluFallback
	delete previewPayload.iluPrerendered

	const sourceText = trimSourceText(payload.source)
	const sourceEnabled = resolveSourceEnabled(payload.sourceEnabled, sourceText)

	if (!sourceEnabled || !sourceText) {
		delete previewPayload.source
	}

	return previewPayload
}

function buildLegacyPreviewUrl(
	baseUrl: string,
	template: string,
	payload: Record<string, unknown>
): string {
	return buildQueryPreviewUrl(baseUrl, template, payload)
}

function formatQueryString(payload: Record<string, unknown>): string {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(payload)) {
		if (value === undefined || value === null || value === '') {
			continue
		}
		params.set(key, String(value))
	}
	const query = params.toString()
	return query ? `?${query}` : ''
}

function buildResolvedPreviewUrl(
	baseUrl: string,
	template: string,
	resolution: GfxTemplateResolution,
	payload: Record<string, unknown>
): string {
	if (resolution.mode === 'caspar' && isSameOriginPreviewBase(baseUrl)) {
		return buildCasparBridgePreviewUrl(baseUrl, resolution.relativePath)
	}
	if (resolution.mode === 'query') {
		return joinPreviewPath(baseUrl, resolution.relativePath) + formatQueryString(payload)
	}
	return buildLegacyPreviewUrl(baseUrl, template, payload)
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
	const [resolution, setResolution] = useState<GfxTemplateResolution | null | undefined>(undefined)
	const [error, setError] = useState<string | null>(null)
	const [frameFailed, setFrameFailed] = useState(false)
	const [bridgeReady, setBridgeReady] = useState(false)
	const iframeRef = useRef<HTMLIFrameElement>(null)

	const template = manifest?.previewTemplate
	const previewPayload = useMemo(() => buildPreviewPayload(payload), [payload])

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

	useEffect(() => {
		if (!template) {
			return
		}
		let cancelled = false
		setResolution(undefined)
		fetchGfxTemplateResolution(template)
			.then((resolved) => {
				if (!cancelled) {
					setResolution(resolved)
				}
			})
			.catch(() => {
				if (!cancelled) {
					setResolution(null)
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
		if (resolution === undefined) {
			return null
		}
		if (resolution) {
			return buildResolvedPreviewUrl(previewBaseUrl, template, resolution, previewPayload)
		}
		return buildLegacyPreviewUrl(previewBaseUrl, template, previewPayload)
	}, [previewBaseUrl, template, resolution, previewPayload])

	const usesCasparBridge = Boolean(
		resolution?.mode === 'caspar' && previewBaseUrl && isSameOriginPreviewBase(previewBaseUrl)
	)

	const postPreviewData = useCallback(() => {
		if (!usesCasparBridge || !bridgeReady) {
			return
		}
		const xml = buildCasparTemplateDataXml(previewPayload)
		iframeRef.current?.contentWindow?.postMessage(
			{
				type: GFX_PREVIEW_MESSAGE,
				xml
			},
			'*'
		)
	}, [usesCasparBridge, bridgeReady, previewPayload])

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.data?.type !== GFX_PREVIEW_READY) {
				return
			}
			if (event.source !== iframeRef.current?.contentWindow) {
				return
			}
			setBridgeReady(true)
		}
		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [])

	useEffect(() => {
		setBridgeReady(false)
		setFrameFailed(false)
	}, [previewUrl])

	useEffect(() => {
		postPreviewData()
	}, [postPreviewData])

	if (!template) {
		return null
	}

	return (
		<div className="gfx-preview mb-3">
			<h3 className="mb-2">GFX Preview</h3>
			{error && <div className="text-warning small mb-2">Preview unavailable: {error}</div>}
			{frameFailed && previewUrl ? (
				<div className="text-warning small mb-2">
					Could not load preview at <code>{previewUrl}</code>
				</div>
			) : null}
			{previewUrl ? (
				<div className="gfx-preview-frame">
					<iframe
						ref={iframeRef}
						key={previewUrl}
						title={`GFX preview for ${piece.name}`}
						src={previewUrl}
						onError={() => setFrameFailed(true)}
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
