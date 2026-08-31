import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ScriptExpandContextValue = {
	expandedPartId: string | null
	setExpandedPartId: (partId: string | null) => void
	toggleExpandedPart: (partId: string) => void
}

const ScriptExpandContext = createContext<ScriptExpandContextValue | null>(null)

export function ScriptExpandProvider({ children }: { children: ReactNode }) {
	const [expandedPartId, setExpandedPartId] = useState<string | null>(null)
	const toggleExpandedPart = useCallback((partId: string) => {
		setExpandedPartId((prev) => (prev === partId ? null : partId))
	}, [])
	const value = useMemo(
		() => ({ expandedPartId, setExpandedPartId, toggleExpandedPart }),
		[expandedPartId, toggleExpandedPart]
	)
	return <ScriptExpandContext.Provider value={value}>{children}</ScriptExpandContext.Provider>
}

export function useScriptExpand(): ScriptExpandContextValue {
	const ctx = useContext(ScriptExpandContext)
	if (!ctx) {
		throw new Error('useScriptExpand must be used within ScriptExpandProvider')
	}
	return ctx
}
