import { useCallback, useEffect, useState } from 'react'
import type { RundownReadiness } from '~backend/background/interfaces'
import { fetchRundownReadiness } from '~/lib/authApi'

const REFRESH_INTERVAL_MS = 10_000

export function useRundownReadiness(rundownId: string) {
	const [readiness, setReadiness] = useState<RundownReadiness | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		try {
			const data = await fetchRundownReadiness(rundownId)
			setReadiness(data)
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load readiness')
		} finally {
			setLoading(false)
		}
	}, [rundownId])

	useEffect(() => {
		setLoading(true)
		void refresh()

		const timer = window.setInterval(() => {
			void refresh()
		}, REFRESH_INTERVAL_MS)

		return () => window.clearInterval(timer)
	}, [refresh])

	return { readiness, loading, error, refresh }
}
