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

export type RundownMediaListing = {
	files: MediaFileEntry[]
	folderPath: string
	absoluteFolderPath: string
	folderExists: boolean
	ingestMediaRoot: string
}

export async function fetchRundownMedia(
	rundownId: string,
	subdir: string = 'clips'
): Promise<RundownMediaListing> {
	const params = new URLSearchParams({ subdir })
	return request<RundownMediaListing>(
		`/api/rundowns/${encodeURIComponent(rundownId)}/media?${params}`
	)
}

export async function ensureRundownMediaFolder(
	rundownId: string,
	subdir: string = 'clips'
): Promise<RundownMediaListing> {
	return request<RundownMediaListing>(
		`/api/rundowns/${encodeURIComponent(rundownId)}/media/ensure-folder`,
		{
			method: 'POST',
			body: JSON.stringify({ subdir })
		}
	)
}

let previewBaseUrlCache: string | null = null

export function clearPreviewBaseUrlCache(): void {
	previewBaseUrlCache = null
}

export async function fetchPreviewBaseUrl(): Promise<string> {
	if (previewBaseUrlCache) {
		return previewBaseUrlCache
	}
	const data = await request<{ previewBaseUrl: string }>('/api/config')
	previewBaseUrlCache = data.previewBaseUrl.replace(/\/$/, '')
	return previewBaseUrlCache
}

export async function fetchAppConfig(): Promise<{
	previewBaseUrl: string
	ingestMediaRoot: string
}> {
	const data = await request<{ previewBaseUrl: string; ingestMediaRoot: string }>('/api/config')
	return {
		previewBaseUrl: data.previewBaseUrl.replace(/\/$/, ''),
		ingestMediaRoot: data.ingestMediaRoot
	}
}
