import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type ReactNode,
	type SetStateAction
} from 'react'
import { getSocket } from '~/lib/socket'
import { useToasts } from '~/components/toasts/useToasts'
import { type PresenceEvictedPayload } from '~/hooks/usePresence'

type ScriptExpandContextValue = {
	expandedPartId: string | null
	setExpandedPartId: Dispatch<SetStateAction<string | null>>
	toggleExpandedPart: (partId: string) => void
}

const ScriptExpandContext = createContext<ScriptExpandContextValue | null>(null)

export function ScriptExpandProvider({ children }: { children: ReactNode }) {
	const toasts = useToasts()
	const [expandedPartId, setExpandedPartId] = useState<string | null>(null)
	const expandedPartIdRef = useRef(expandedPartId)
	expandedPartIdRef.current = expandedPartId

	const toggleExpandedPart = useCallback((partId: string) => {
		setExpandedPartId((prev) => (prev === partId ? null : partId))
	}, [])

	useEffect(() => {
		const socket = getSocket()
		const onEvicted = (payload: PresenceEvictedPayload) => {
			if (!payload || payload.entityType !== 'part') {
				return
			}
			if (expandedPartIdRef.current !== payload.entityId) {
				return
			}
			const by = payload.byDisplayName?.trim()
			toasts.show({
				headerContent: 'Story lock taken',
				bodyContent: by
					? `${by} opened this story. Unsaved changes in this panel may be lost.`
					: 'Another user opened this story. Unsaved changes in this panel may be lost.'
			})
			setExpandedPartId(null)
		}
		socket.on('presence:evicted', onEvicted)
		return () => {
			socket.off('presence:evicted', onEvicted)
		}
	}, [toasts])

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
