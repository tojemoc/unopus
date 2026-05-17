import { randomBytes } from 'crypto'
import { db } from '../db'
import { v4 as uuid } from 'uuid'
import { hashPassword, verifyPassword } from './password'
import type { AuthUser, SessionUser, UserRole } from './types'

const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const SESSION_COOKIE = 'duopus_session'

interface UserRow {
	id: string
	username: string
	password_hash: string
	display_name: string
	role: UserRole
	active: number
}

interface SessionRow {
	id: string
	user_id: string
	expires_at: number
}

function rowToUser(row: UserRow): AuthUser {
	return {
		id: row.id,
		username: row.username,
		displayName: row.display_name,
		role: row.role,
		active: row.active === 1
	}
}

export function initAuthTables(): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			display_name TEXT NOT NULL,
			role TEXT NOT NULL CHECK(role IN ('editor', 'admin')),
			active INTEGER NOT NULL DEFAULT 1
		);
	`)

	db.exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id)
		);
	`)

	db.exec(`
		CREATE TABLE IF NOT EXISTS entity_edits (
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			user_id TEXT,
			display_name TEXT NOT NULL,
			edited_at INTEGER NOT NULL,
			PRIMARY KEY (entity_type, entity_id)
		);
	`)

	const countRow = db.prepare(`SELECT COUNT(*) AS count FROM users`).get() as { count: number }
	if (countRow.count === 0) {
		const bootstrapPassword =
			process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() ||
			randomBytes(18).toString('base64url')
		db.prepare(
			`
			INSERT INTO users (id, username, password_hash, display_name, role, active)
			VALUES (?, ?, ?, ?, ?, 1)
		`
		).run(uuid(), 'admin', hashPassword(bootstrapPassword), 'Administrator', 'admin')
		if (process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim()) {
			console.log('Seeded default admin user (username: admin) from BOOTSTRAP_ADMIN_PASSWORD')
		} else if (process.env.NODE_ENV !== 'production') {
			console.log(
				'Seeded default admin user (username: admin). Bootstrap password (dev only):',
				bootstrapPassword
			)
		} else {
			console.warn(
				'Seeded default admin user (username: admin). Set BOOTSTRAP_ADMIN_PASSWORD or reset the password before use.'
			)
		}
	}
}

export function getSessionCookieName(): string {
	return SESSION_COOKIE
}

export function authenticateUser(
	username: string,
	password: string
): SessionUser | null {
	const row = db
		.prepare(
			`
			SELECT id, username, password_hash, display_name, role, active
			FROM users
			WHERE username = ?
		`
		)
		.get(username) as UserRow | undefined

	if (!row || row.active !== 1 || !verifyPassword(password, row.password_hash)) {
		return null
	}

	return rowToUser(row)
}

export function createSession(userId: string): { sessionId: string; expiresAt: number } {
	const sessionId = uuid()
	const expiresAt = Date.now() + SESSION_TTL_MS
	db.prepare(
		`
		INSERT INTO sessions (id, user_id, expires_at)
		VALUES (?, ?, ?)
	`
	).run(sessionId, userId, expiresAt)
	return { sessionId, expiresAt }
}

export function deleteSession(sessionId: string): void {
	db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId)
}

export function purgeExpiredSessions(): void {
	db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(Date.now())
}

export function getUserFromSession(sessionId: string | undefined): SessionUser | null {
	if (!sessionId) {
		return null
	}
	purgeExpiredSessions()

	const row = db
		.prepare(
			`
			SELECT u.id, u.username, u.display_name, u.role, u.active, s.expires_at
			FROM sessions s
			JOIN users u ON u.id = s.user_id
			WHERE s.id = ? AND s.expires_at >= ? AND u.active = 1
		`
		)
		.get(sessionId, Date.now()) as
		| (UserRow & { expires_at: number })
		| undefined

	if (!row) {
		return null
	}

	return rowToUser(row)
}

export function parseSessionCookie(cookieHeader: string | undefined): string | undefined {
	if (!cookieHeader) {
		return undefined
	}
	const prefix = `${SESSION_COOKIE}=`
	for (const part of cookieHeader.split(';')) {
		const trimmed = part.trim()
		if (trimmed.startsWith(prefix)) {
			try {
				return decodeURIComponent(trimmed.slice(prefix.length))
			} catch {
				return undefined
			}
		}
	}
	return undefined
}

export function buildSessionCookie(sessionId: string, expiresAt: number): string {
	const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
	return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`
}

export function buildClearSessionCookie(): string {
	return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
}

export function listUsers(): AuthUser[] {
	const rows = db
		.prepare(
			`
			SELECT id, username, password_hash, display_name, role, active
			FROM users
			ORDER BY username COLLATE NOCASE
		`
		)
		.all() as unknown as UserRow[]
	return rows.map(rowToUser)
}

export class DuplicateUsernameError extends Error {
	constructor() {
		super('Username already exists')
		this.name = 'DuplicateUsernameError'
	}
}

function isUniqueConstraintError(err: unknown): boolean {
	if (!(err instanceof Error)) {
		return false
	}
	const code = (err as { code?: string }).code
	return (
		code === 'SQLITE_CONSTRAINT_UNIQUE' ||
		err.message.includes('UNIQUE constraint failed')
	)
}

export function createUser(payload: {
	username: string
	password: string
	displayName: string
	role: UserRole
}): AuthUser {
	const id = uuid()
	try {
		db.prepare(
			`
			INSERT INTO users (id, username, password_hash, display_name, role, active)
			VALUES (?, ?, ?, ?, ?, 1)
		`
		).run(
			id,
			payload.username,
			hashPassword(payload.password),
			payload.displayName,
			payload.role
		)
	} catch (err) {
		if (isUniqueConstraintError(err)) {
			throw new DuplicateUsernameError()
		}
		throw err
	}
	return rowToUser(
		db
			.prepare(
				`
				SELECT id, username, password_hash, display_name, role, active
				FROM users WHERE id = ?
			`
			)
			.get(id) as unknown as UserRow
	)
}

export function updateUser(
	id: string,
	updates: {
		displayName?: string
		role?: UserRole
		password?: string
		active?: boolean
	}
): AuthUser | null {
	const existing = db
		.prepare(
			`
			SELECT id, username, password_hash, display_name, role, active
			FROM users WHERE id = ?
		`
		)
		.get(id) as UserRow | undefined
	if (!existing) {
		return null
	}

	const displayName = updates.displayName ?? existing.display_name
	const role = updates.role ?? existing.role
	const active = updates.active === undefined ? existing.active : updates.active ? 1 : 0
	const passwordHash = updates.password ? hashPassword(updates.password) : existing.password_hash

	db.prepare(
		`
		UPDATE users
		SET display_name = ?, role = ?, active = ?, password_hash = ?
		WHERE id = ?
	`
	).run(displayName, role, active, passwordHash, id)

	return rowToUser(
		db
			.prepare(
				`
				SELECT id, username, password_hash, display_name, role, active
				FROM users WHERE id = ?
			`
			)
			.get(id) as unknown as UserRow
	)
}

export function recordEntityEdit(
	entityType: string,
	entityId: string,
	user: SessionUser | undefined
): void {
	const displayName = user?.displayName ?? 'Unknown'
	const userId = user?.id ?? null
	db.prepare(
		`
		INSERT INTO entity_edits (entity_type, entity_id, user_id, display_name, edited_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(entity_type, entity_id) DO UPDATE SET
			user_id = excluded.user_id,
			display_name = excluded.display_name,
			edited_at = excluded.edited_at
	`
	).run(entityType, entityId, userId, displayName, Date.now())
}

export function getEntityEdit(
	entityType: string,
	entityId: string
): { displayName: string; editedAt: number } | null {
	const row = db
		.prepare(
			`
			SELECT display_name, edited_at
			FROM entity_edits
			WHERE entity_type = ? AND entity_id = ?
		`
		)
		.get(entityType, entityId) as { display_name: string; edited_at: number } | undefined
	if (!row) {
		return null
	}
	return { displayName: row.display_name, editedAt: row.edited_at }
}

export function getEntityEditsForRundown(
	rundownId: string
): Record<string, { displayName: string; editedAt: number }> {
	const rows = db
		.prepare(
			`
			SELECT e.entity_id, e.display_name, e.edited_at
			FROM entity_edits e
			JOIN parts p ON p.id = e.entity_id
			WHERE e.entity_type = 'part' AND p.rundownId = ?
		`
		)
		.all(rundownId) as Array<{ entity_id: string; display_name: string; edited_at: number }>

	const result: Record<string, { displayName: string; editedAt: number }> = {}
	for (const row of rows) {
		result[row.entity_id] = { displayName: row.display_name, editedAt: row.edited_at }
	}
	return result
}
