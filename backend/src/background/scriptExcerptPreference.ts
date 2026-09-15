/**
 * Story-row script excerpt visibility.
 *
 * Built-in default: ON.
 * ApplicationSettings.showPartScriptExcerpt overwrites that site default.
 * Per-account AuthUser.showPartScriptExcerpt overrides the site default when set
 * (null/undefined → follow site).
 */

/**
 * Resolve whether the PART/story row should show a one-line script excerpt.
 */
export function resolveShowPartScriptExcerpt(
	userPreference: boolean | null | undefined,
	siteDefault: boolean | null | undefined
): boolean {
	if (userPreference === true || userPreference === false) {
		return userPreference
	}
	return siteDefault !== false
}
