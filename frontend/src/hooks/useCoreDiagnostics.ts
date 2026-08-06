import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCoreDiagnostics, type CoreDiagnosticsResponse } from '~/lib/authApi'

const REFRESH_INTERVAL_MS = 10_000

export function useCoreDiagnostics() {
	const [diagnostics, setDiagnostics] = useState<CoreDiagnosticsResponse | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const requestIdRef = useRef(0)

	const refresh = useCallback(async () => {
		const requestId = ++requestIdRef.current

		try {
			const data = await fetchCoreDiagnostics()
			if (requestId !== requestIdRef.current) {
				return
			}
			setDiagnostics(data)
			setError(null)
		} catch (err) {
			if (requestId !== requestIdRef.current) {
				return
			}
			setError(err instanceof Error ? err.message : 'Failed to load Core diagnostics')
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false)
			}
		}
	}, [])

	useEffect(() => {
		requestIdRef.current += 1
		setLoading(true)
		void refresh()

		const timer = window.setInterval(() => {
			void refresh()
		}, REFRESH_INTERVAL_MS)

		return () => {
			requestIdRef.current += 1
			window.clearInterval(timer)
		}
	}, [refresh])

	return { diagnostics, loading, error, refresh }
}
