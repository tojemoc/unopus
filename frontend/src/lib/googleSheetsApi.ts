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

export interface RundownSheetPreviewResult {
	rows: unknown[]
	rowCount: number
}

export interface GoogleSheetsSyncResult {
	ok: boolean
	sheetsConfigured?: boolean
	rowCount: number
	sheetWrite?: GoogleSheetsWriteInfo
	error?: string
}

export interface GoogleSheetsPullResult {
	ok: boolean
	sheetRowCount: number
	updatedParts: number
	updatedPieces: number
	createdParts: number
	createdPieces: number
	error?: string
}

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

export async function previewRundownSheetRows(rundownId: string): Promise<RundownSheetPreviewResult> {
	return request<RundownSheetPreviewResult>(
		`/api/rundowns/${encodeURIComponent(rundownId)}/google-sheets/preview`
	)
}

export async function syncRundownEditorToGoogleSheets(
	rundownId: string
): Promise<GoogleSheetsSyncResult> {
	return request<GoogleSheetsSyncResult>(
		`/api/rundowns/${encodeURIComponent(rundownId)}/google-sheets/sync-from-rundown`,
		{
			method: 'POST',
			body: '{}'
		}
	)
}

export async function pullRundownFromGoogleSheets(
	rundownId: string
): Promise<GoogleSheetsPullResult> {
	return request<GoogleSheetsPullResult>(
		`/api/rundowns/${encodeURIComponent(rundownId)}/google-sheets/pull`,
		{
			method: 'POST',
			body: '{}'
		}
	)
}
