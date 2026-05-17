import type { Application, Request, Response } from 'express'
import {
	authenticateUser,
	buildClearSessionCookie,
	buildSessionCookie,
	createSession,
	createUser,
	deleteSession,
	DuplicateUsernameError,
	getUserFromSession,
	listUsers,
	parseSessionCookie,
	updateUser
} from '../background/auth/authStore'
import type { SessionUser, UserRole } from '../background/auth/types'

function sendJson(res: Response, status: number, body: unknown): void {
	res.status(status).json(body)
}

function getSessionUser(req: Request): SessionUser | null {
	const sessionId = parseSessionCookie(req.headers.cookie)
	return getUserFromSession(sessionId)
}

function requireAuth(req: Request, res: Response): SessionUser | null {
	const user = getSessionUser(req)
	if (!user) {
		sendJson(res, 401, { error: 'Not authenticated' })
		return null
	}
	return user
}

function requireAdmin(req: Request, res: Response): SessionUser | null {
	const user = requireAuth(req, res)
	if (!user) {
		return null
	}
	if (user.role !== 'admin') {
		sendJson(res, 403, { error: 'Admin access required' })
		return null
	}
	return user
}

export function registerAuthRoutes(app: Application): void {
	app.post('/api/auth/login', (req: Request, res: Response) => {
		const body = req.body as { username?: string; password?: string }
		if (!body.username || !body.password) {
			sendJson(res, 400, { error: 'Username and password are required' })
			return
		}

		const user = authenticateUser(body.username, body.password)
		if (!user) {
			sendJson(res, 401, { error: 'Invalid username or password' })
			return
		}

		const { sessionId, expiresAt } = createSession(user.id)
		res.setHeader('Set-Cookie', buildSessionCookie(sessionId, expiresAt))
		sendJson(res, 200, {
			user: {
				id: user.id,
				username: user.username,
				displayName: user.displayName,
				role: user.role
			}
		})
	})

	app.post('/api/auth/logout', (req: Request, res: Response) => {
		const sessionId = parseSessionCookie(req.headers.cookie)
		if (sessionId) {
			deleteSession(sessionId)
		}
		res.setHeader('Set-Cookie', buildClearSessionCookie())
		sendJson(res, 200, { ok: true })
	})

	app.get('/api/auth/me', (req: Request, res: Response) => {
		const user = getSessionUser(req)
		if (!user) {
			sendJson(res, 401, { error: 'Not authenticated' })
			return
		}
		sendJson(res, 200, {
			user: {
				id: user.id,
				username: user.username,
				displayName: user.displayName,
				role: user.role
			}
		})
	})

	app.get('/api/auth/users', (req: Request, res: Response) => {
		if (!requireAdmin(req, res)) {
			return
		}
		sendJson(res, 200, {
			users: listUsers().map((u) => ({
				id: u.id,
				username: u.username,
				displayName: u.displayName,
				role: u.role,
				active: u.active
			}))
		})
	})

	app.post('/api/auth/users', (req: Request, res: Response) => {
		if (!requireAdmin(req, res)) {
			return
		}
		const body = req.body as {
			username?: string
			password?: string
			displayName?: string
			role?: UserRole
		}
		if (!body.username || !body.password || !body.displayName || !body.role) {
			sendJson(res, 400, { error: 'username, password, displayName, and role are required' })
			return
		}
		if (body.role !== 'editor' && body.role !== 'admin') {
			sendJson(res, 400, { error: 'role must be editor or admin' })
			return
		}

		try {
			const user = createUser({
				username: body.username,
				password: body.password,
				displayName: body.displayName,
				role: body.role
			})
			sendJson(res, 201, {
				user: {
					id: user.id,
					username: user.username,
					displayName: user.displayName,
					role: user.role,
					active: user.active
				}
			})
		} catch (err) {
			if (err instanceof DuplicateUsernameError) {
				sendJson(res, 409, { error: 'Username already exists' })
				return
			}
			console.error('Failed to create user', err)
			sendJson(res, 500, { error: 'Failed to create user' })
		}
	})

	app.patch('/api/auth/users/:id', (req: Request, res: Response) => {
		if (!requireAdmin(req, res)) {
			return
		}
		const body = req.body as {
			displayName?: string
			role?: UserRole
			password?: string
			active?: boolean
		}
		if (body.role !== undefined && body.role !== 'editor' && body.role !== 'admin') {
			sendJson(res, 400, { error: 'role must be editor or admin' })
			return
		}
		if (body.active !== undefined && typeof body.active !== 'boolean') {
			sendJson(res, 400, { error: 'active must be a boolean' })
			return
		}

		const userId = String(req.params.id)
		const updated = updateUser(userId, body)
		if (!updated) {
			sendJson(res, 404, { error: 'User not found' })
			return
		}
		sendJson(res, 200, {
			user: {
				id: updated.id,
				username: updated.username,
				displayName: updated.displayName,
				role: updated.role,
				active: updated.active
			}
		})
	})
}
