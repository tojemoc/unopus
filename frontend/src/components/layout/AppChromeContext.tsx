import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const SIDEBAR_STORAGE_KEY = 'unopus-sidebar-collapsed'

type AppChromeContextValue = {
	sidebarCollapsed: boolean
	toggleSidebar: () => void
	setSidebarCollapsed: (collapsed: boolean) => void
}

const AppChromeContext = createContext<AppChromeContextValue | null>(null)

function readCollapsed(): boolean {
	try {
		return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
	} catch {
		return false
	}
}

export function AppChromeProvider({ children }: { children: ReactNode }) {
	const [sidebarCollapsed, setSidebarCollapsedState] = useState(readCollapsed)

	const setSidebarCollapsed = useCallback((collapsed: boolean) => {
		setSidebarCollapsedState(collapsed)
		try {
			localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0')
		} catch {
			/* ignore */
		}
	}, [])

	const toggleSidebar = useCallback(() => {
		setSidebarCollapsedState((prev) => {
			const next = !prev
			try {
				localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0')
			} catch {
				/* ignore */
			}
			return next
		})
	}, [])

	useEffect(() => {
		document.documentElement.dataset.sidebar = sidebarCollapsed ? 'collapsed' : 'expanded'
	}, [sidebarCollapsed])

	const value = useMemo(
		() => ({ sidebarCollapsed, toggleSidebar, setSidebarCollapsed }),
		[sidebarCollapsed, toggleSidebar, setSidebarCollapsed]
	)

	return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>
}

export function useAppChrome(): AppChromeContextValue {
	const ctx = useContext(AppChromeContext)
	if (!ctx) {
		throw new Error('useAppChrome must be used within AppChromeProvider')
	}
	return ctx
}
