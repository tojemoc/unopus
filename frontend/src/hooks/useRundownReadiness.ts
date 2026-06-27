import { useCallback, useEffect, useRef, useState } from 'react'
import type { RundownReadiness } from '~backend/background/interfaces'
import { fetchRundownReadiness } from '~/lib/authApi'

const REFRESH_INTERVAL_MS = 10_000

export function useRundownReadiness(rundownId: string) {
	const [readiness, setReadiness] = useState<RundownReadiness | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const requestIdRef = useRef(0)

	const refresh = useCallback(async () => {
		const requestId = ++requestIdRef.current

		try {
			const data = await fetchRundownReadiness(rundownId)
			if (requestId !== requestIdRef.current) {
				return
			}
			setReadiness(data)
			setError(null)
		} catch (err) {
			if (requestId !== requestIdRef.current) {
				return
			}
			setError(err instanceof Error ? err.message : 'Failed to load readiness')
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false)
			}
		}
	}, [rundownId])

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

	return { readiness, loading, error, refresh }
}
