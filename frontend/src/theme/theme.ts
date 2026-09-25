export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'unopus-theme'

export function getStoredTheme(): ThemeMode | null {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return null
	}

	try {
		const value = localStorage.getItem(STORAGE_KEY)
		return value === 'dark' || value === 'light' ? value : null
	} catch {
		return null
	}
}

/** Product default is dark (broadcast/newsroom). System preference is ignored until the user toggles. */
export function getPreferredTheme(): ThemeMode {
	return 'dark'
}

export function resolveTheme(stored: ThemeMode | null = getStoredTheme()): ThemeMode {
	return stored ?? getPreferredTheme()
}

export function applyThemeToDocument(theme: ThemeMode): void {
	if (typeof document === 'undefined') {
		return
	}

	document.documentElement.setAttribute('data-theme', theme)
	document.documentElement.setAttribute('data-bs-theme', theme)
}

export function persistThemePreference(theme: ThemeMode): void {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return
	}

	try {
		localStorage.setItem(STORAGE_KEY, theme)
	} catch {
		// Storage may be blocked (private mode, sandboxed iframe, SecurityError).
	}
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
