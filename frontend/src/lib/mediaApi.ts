import type { MediaFileEntry } from '~backend/background/interfaces'

const apiBase = import.meta.env.MODE === 'development' ? '' : ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${apiBase}${path}`, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {})
		},
		...init
	})
	const body = (await response.json()) as T & { error?: string }
	if (!response.ok) {
		throw new Error('error' in body && body.error ? body.error : 'Request failed')
	}
	return body
}

export async function fetchRundownMedia(
	rundownId: string,
	subdir: string = 'clips'
): Promise<MediaFileEntry[]> {
	const params = new URLSearchParams({ subdir })
	const data = await request<{ files: MediaFileEntry[] }>(
		`/api/rundowns/${encodeURIComponent(rundownId)}/media?${params}`
	)
	return data.files
}

let previewBaseUrlCache: string | null = null

export async function fetchPreviewBaseUrl(): Promise<string> {
	if (previewBaseUrlCache) {
		return previewBaseUrlCache
	}
	const data = await request<{ previewBaseUrl: string }>('/api/config')
	previewBaseUrlCache = data.previewBaseUrl.replace(/\/$/, '')
	return previewBaseUrlCache
}
