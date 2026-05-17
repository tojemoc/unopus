export type UserRole = 'editor' | 'admin'

export interface AuthUser {
	id: string
	username: string
	displayName: string
	role: UserRole
	active: boolean
}

export interface SessionUser extends AuthUser {}

export interface PublicUser extends AuthUser {}
