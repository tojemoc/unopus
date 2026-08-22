export type UserRole = 'editor' | 'admin'

export interface AuthUser {
	id: string
	username: string
	displayName: string
	role: UserRole
	active: boolean
	/** Personal script CPS; null = use site default from ApplicationSettings. */
	scriptCps?: number | null
}

export interface SessionUser extends AuthUser {}

export interface PublicUser extends AuthUser {}
