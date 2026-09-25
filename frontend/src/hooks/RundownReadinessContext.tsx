import { createContext, useContext, type ReactNode } from 'react'
import { useRundownReadiness } from './useRundownReadiness'

type RundownReadinessContextValue = ReturnType<typeof useRundownReadiness>

const RundownReadinessContext = createContext<RundownReadinessContextValue | null>(null)

export function RundownReadinessProvider({
	rundownId,
	children
}: {
	rundownId: string
	children: ReactNode
}) {
	const value = useRundownReadiness(rundownId)
	return (
		<RundownReadinessContext.Provider value={value}>{children}</RundownReadinessContext.Provider>
	)
}

export function useRundownReadinessContext(): RundownReadinessContextValue {
	const context = useContext(RundownReadinessContext)
	if (!context) {
		throw new Error('useRundownReadinessContext must be used within RundownReadinessProvider')
	}
	return context
}

/** Safe outside the provider (e.g. global header on non-rundown pages). */
export function useRundownReadinessContextOptional(): RundownReadinessContextValue | null {
	return useContext(RundownReadinessContext)
}
