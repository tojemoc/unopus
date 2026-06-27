import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
	applyThemeToDocument,
	getStoredTheme,
	persistThemePreference,
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
		applyThemeToDocument(theme)
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
				persistThemePreference(next)
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
	const [theme, setThemeState] = useState<ThemeMode>(() => resolveTheme())

	useEffect(() => {
		if (context) {
			return
		}
		applyThemeToDocument(theme)
	}, [context, theme])

	if (context) {
		return context
	}

	return {
		theme,
		setTheme: (next: ThemeMode) => {
			persistThemePreference(next)
			setThemeState(next)
		},
		toggle: () => {
			setThemeState((current) => toggleTheme(current))
		}
	}
}
