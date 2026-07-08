export type UserRole = 'editor' | 'admin'

export interface AuthUser {
	id: string
	username: string
	displayName: string
	role: UserRole
	active?: boolean
}

const apiBase = import.meta.env.MODE === 'development' ? '' : ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${apiBase}${path}`, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {})
		},
		...init
	})
	const body = (await response.json()) as T & { error?: string }
	if (!response.ok) {
		throw new Error('error' in body && body.error ? body.error : 'Request failed')
	}
	return body
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
	try {
		const data = await request<{ user: AuthUser }>('/api/auth/me')
		return data.user
	} catch {
		return null
	}
}

export async function login(username: string, password: string): Promise<AuthUser> {
	const data = await request<{ user: AuthUser }>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({ username, password })
	})
	return data.user
}

export async function logout(): Promise<void> {
	await request('/api/auth/logout', { method: 'POST' })
}

export async function listUsers(): Promise<AuthUser[]> {
	const data = await request<{ users: AuthUser[] }>('/api/auth/users')
	return data.users
}

export async function createUser(payload: {
	username: string
	password: string
	displayName: string
	role: UserRole
}): Promise<AuthUser> {
	const data = await request<{ user: AuthUser }>('/api/auth/users', {
		method: 'POST',
		body: JSON.stringify(payload)
	})
	return data.user
}

export async function updateUser(
	id: string,
	payload: Partial<{
		displayName: string
		role: UserRole
		password: string
		active: boolean
	}>
): Promise<AuthUser> {
	const data = await request<{ user: AuthUser }>(`/api/auth/users/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	})
	return data.user
}

export async function fetchRundownEdits(
	rundownId: string
): Promise<Record<string, { displayName: string; editedAt: number }>> {
	const data = await request<{
		edits: Record<string, { displayName: string; editedAt: number }>
	}>(`/api/edits/rundown/${rundownId}`)
	return data.edits
}

export async function fetchEntityEdit(
	entityType: string,
	entityId: string
): Promise<{ displayName: string; editedAt: number } | null> {
	const data = await request<{
		edit: { displayName: string; editedAt: number } | null
	}>(`/api/edits/${entityType}/${entityId}`)
	return data.edit
}

export async function fetchRundownReadiness(rundownId: string) {
	return request<import('~backend/background/interfaces').RundownReadiness>(
		`/api/rundowns/${rundownId}/readiness`
	)
}
