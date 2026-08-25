/** Temporary debug ingest — remove after fix verification. */
export function agentLog(
	hypothesisId: string,
	location: string,
	message: string,
	data: Record<string, unknown> = {}
): void {
	// #region agent log
	fetch('http://127.0.0.1:7299/ingest', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			hypothesisId,
			location,
			message,
			data,
			timestamp: Date.now()
		})
	}).catch(() => {})
	// #endregion
}
