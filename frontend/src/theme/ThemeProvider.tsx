import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
	applyTheme,
	getPreferredTheme,
	getStoredTheme,
	resolveTheme,
	toggleTheme,
	type ThemeMode
} from './theme'

type ThemeContextValue = {
	theme: ThemeMode
	setTheme: (theme: ThemeMode) => void
	toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<ThemeMode>(() => resolveTheme())

	useEffect(() => {
		applyTheme(theme)
	}, [theme])

	useEffect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)')

		const onChange = () => {
			if (getStoredTheme()) {
				return
			}
			setThemeState(media.matches ? 'dark' : 'light')
		}

		media.addEventListener('change', onChange)
		return () => media.removeEventListener('change', onChange)
	}, [])

	const value = useMemo(
		() => ({
			theme,
			setTheme: (next: ThemeMode) => {
				applyTheme(next)
				setThemeState(next)
			},
			toggle: () => {
				setThemeState((current) => toggleTheme(current))
			}
		}),
		[theme]
	)

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext)
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider')
	}
	return context
}

export function useThemeOptional(): ThemeContextValue {
	const context = useContext(ThemeContext)
	if (context) {
		return context
	}

	const fallbackTheme = getStoredTheme() ?? getPreferredTheme()
	return {
		theme: fallbackTheme,
		setTheme: applyTheme,
		toggle: () => toggleTheme(fallbackTheme)
	}
}
