async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {})
		},
		credentials: 'include'
	})
	const data = (await response.json()) as T & { error?: string }
	if (!response.ok) {
		throw new Error(data.error ?? `Request failed (${response.status})`)
	}
	return data
}

export interface GoogleSheetsStatus {
	configured: boolean
	spreadsheetId: string | null
	sheetName: string | null
	dataStartRow: number
	hasCredentials: boolean
}

export interface GoogleSheetsWriteInfo {
	updatedRange: string
	rowCount: number
}

export interface NrcsMapToRowsResult {
	rows: unknown[]
	columns: string[]
}

export interface GoogleSheetsSyncResult {
	ok: boolean
	sheetsConfigured: boolean
	rowCount: number
	sheetWrite?: GoogleSheetsWriteInfo
	error?: string
}

export const nrcsLocalStorageKey = (rundownId: string) => `sofie.googleSheets.nrcs.${rundownId}`

export async function fetchGoogleSheetsStatus(): Promise<GoogleSheetsStatus> {
	return request<GoogleSheetsStatus>('/api/google-sheets/status')
}

export async function testGoogleSheetsConnection(): Promise<{
	ok: boolean
	title?: string
	sheetTitle?: string
	error?: string
}> {
	try {
		return await request<{ ok: boolean; title?: string; sheetTitle?: string }>(
			'/api/google-sheets/test',
			{ method: 'POST', body: '{}' }
		)
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Connection test failed' }
	}
}

export async function previewNrcsSheetRows(nrcs: unknown): Promise<NrcsMapToRowsResult> {
	return request<NrcsMapToRowsResult>('/api/nrcs/map-to-rows', {
		method: 'POST',
		body: JSON.stringify(nrcs)
	})
}

export async function syncRundownToGoogleSheets(
	rundownId: string,
	nrcs: unknown
): Promise<GoogleSheetsSyncResult> {
	return request<GoogleSheetsSyncResult>(`/api/rundowns/${encodeURIComponent(rundownId)}/google-sheets/sync`, {
		method: 'POST',
		body: JSON.stringify(nrcs)
	})
}
