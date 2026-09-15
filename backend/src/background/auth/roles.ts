import type { UserRole } from './types'

export const USER_ROLES: UserRole[] = ['viewer', 'editor', 'tech_admin', 'admin']

/** Rundown / piece mutations — viewers are read-only. */
export function canEditRundown(role: UserRole | undefined | null): boolean {
	return role === 'editor' || role === 'tech_admin' || role === 'admin'
}

/** Tech-only piece types (Cam, WIPE, …) — visible to tech admins and admins. */
export function canSeeTechPieces(role: UserRole | undefined | null): boolean {
	return role === 'tech_admin' || role === 'admin'
}

export function isAdminRole(role: UserRole | undefined | null): boolean {
	return role === 'admin'
}

export function isValidUserRole(value: unknown): value is UserRole {
	return typeof value === 'string' && (USER_ROLES as string[]).includes(value)
}
