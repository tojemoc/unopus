import type { Socket } from 'socket.io'
import { getUserFromSession, parseSessionCookie } from './authStore'
import type { SessionUser } from './types'

export interface AuthenticatedSocket extends Socket {
	data: {
		user?: SessionUser
	}
}

export function attachSocketAuth(socket: AuthenticatedSocket): boolean {
	const cookieHeader = socket.handshake.headers.cookie
	const sessionId = parseSessionCookie(cookieHeader)
	const user = getUserFromSession(sessionId)
	if (!user) {
		return false
	}
	socket.data.user = user
	return true
}
