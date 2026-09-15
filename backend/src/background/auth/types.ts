export type UserRole = 'editor' | 'admin'

export interface AuthUser {
	id: string
	username: string
	displayName: string
	role: UserRole
	active: boolean
	/** Personal script CPS; null = use site default from ApplicationSettings. */
	scriptCps?: number | null
	/**
	 * Personal story-row script excerpt preference.
	 * null = use ApplicationSettings.showPartScriptExcerpt (built-in default ON).
	 */
	showPartScriptExcerpt?: boolean | null
}

export interface SessionUser extends AuthUser {}

export interface PublicUser extends AuthUser {}
