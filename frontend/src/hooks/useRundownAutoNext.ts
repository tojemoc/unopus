import { useCallback, useEffect, useRef, useState } from 'react'
import type { RundownAutoNextState } from '~backend/background/autoNextTypes'
import { fetchRundownAutoNextState } from '~/lib/authApi'

const REFRESH_INTERVAL_MS = 10_000

export function useRundownAutoNext(rundownId: string) {
	const [state, setState] = useState<RundownAutoNextState | null>(null)
	const [loading, setLoading] = useState(true)
	const requestIdRef = useRef(0)

	const refresh = useCallback(async () => {
		const requestId = ++requestIdRef.current
		try {
			const data = await fetchRundownAutoNextState(rundownId)
			if (requestId === requestIdRef.current) {
				setState(data)
			}
		} catch (error) {
			if (requestId === requestIdRef.current) {
				console.error('Could not refresh Core AUTO state:', error)
				setState({
					rundownId,
					source: 'core-error',
					parts: [],
					checkedAt: new Date().toISOString()
				})
			}
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false)
			}
		}
	}, [rundownId])

	useEffect(() => {
		requestIdRef.current += 1
		setState(null)
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

	return { state, loading, refresh }
}
