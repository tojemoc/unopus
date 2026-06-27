export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'unopus-theme'

export function getStoredTheme(): ThemeMode | null {
	const value = localStorage.getItem(STORAGE_KEY)
	return value === 'dark' || value === 'light' ? value : null
}

export function getPreferredTheme(): ThemeMode {
	if (typeof window === 'undefined') {
		return 'dark'
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(stored: ThemeMode | null = getStoredTheme()): ThemeMode {
	return stored ?? getPreferredTheme()
}

export function applyThemeToDocument(theme: ThemeMode): void {
	document.documentElement.setAttribute('data-theme', theme)
}

export function persistThemePreference(theme: ThemeMode): void {
	localStorage.setItem(STORAGE_KEY, theme)
}

export function applyTheme(theme: ThemeMode): void {
	applyThemeToDocument(theme)
	persistThemePreference(theme)
}

export function initTheme(): ThemeMode {
	const theme = resolveTheme()
	applyThemeToDocument(theme)
	return theme
}

export function toggleTheme(current: ThemeMode): ThemeMode {
	const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
	persistThemePreference(next)
	applyThemeToDocument(next)
	return next
}
