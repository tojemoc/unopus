export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'unopus-theme'

function isStorageAvailable(): boolean {
	return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

export function getStoredTheme(): ThemeMode | null {
	if (!isStorageAvailable()) {
		return null
	}

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
	if (typeof document === 'undefined') {
		return
	}

	document.documentElement.setAttribute('data-theme', theme)
}

export function persistThemePreference(theme: ThemeMode): void {
	if (!isStorageAvailable()) {
		return
	}

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

export function getToggledTheme(current: ThemeMode): ThemeMode {
	return current === 'dark' ? 'light' : 'dark'
}
