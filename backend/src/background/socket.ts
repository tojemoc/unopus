import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

let ioInstance: SocketIOServer | null = null

/**
 * Initialize Socket.IO server instance with the HTTP server.
 * Returns undefined if already initialized.
 */
export function initSocket(server: HTTPServer): SocketIOServer | undefined {
	if (ioInstance) {
		return
	}
	const corsOrigin =
		process.env.NODE_ENV === 'development'
			? ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173']
			: false

	ioInstance = new SocketIOServer(server, {
		cors: {
			origin: corsOrigin,
			credentials: true
		}
	})

	return ioInstance
}

/**
 * Get the initialized Socket.IO server instance.
 * Returns undefined if not yet initialized.
 */
export function getSocketIO(): SocketIOServer | undefined {
	if (!ioInstance) {
		return
	}
	return ioInstance
}
