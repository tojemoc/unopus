import express from 'express'
import http from 'http'
import path from 'path'
import { Server, Socket } from 'socket.io'
import { registerSettingsHandlers } from './background/api/settings'
import { registerTypeManifestsHandlers } from './background/api/typeManifests'
import { registerSegmentsHandlers } from './background/api/segments'
import { registerPlaylistsHandlers } from './background/api/playlists'
import { registerRundownsHandlers } from './background/api/rundowns'
import { registerPiecesHandlers } from './background/api/pieces'
import { registerPartsHandlers } from './background/api/parts'
import { initSocket } from './background/socket'
import { registerCoreConnectionInfoHandlers } from './background/api/coreConnectionInfo'
import { attachSocketAuth, type AuthenticatedSocket } from './background/auth/socketAuth'
import { getUserFromSession, parseSessionCookie } from './background/auth/authStore'
import { registerAuthRoutes } from './routes/auth'
import { registerEditsRoutes } from './routes/edits'
import { registerStoryRoutes } from './routes/story'
import { registerRundownScheduleRoutes } from './routes/rundownSchedule'
import { registerNrcsSheetsRoutes } from './routes/nrcsSheets'

const frontendPath = path.resolve(__dirname, '../../frontend/dist')

const PUBLIC_API_PREFIXES = ['/api/auth/login']

function isPublicApiPath(url: string | undefined): boolean {
	if (!url) {
		return false
	}
	return PUBLIC_API_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}?`))
}

function isSpaAssetPath(url: string | undefined): boolean {
	if (!url) {
		return false
	}
	return (
		url.startsWith('/assets/') ||
		url === '/favicon.png' ||
		url.endsWith('.js') ||
		url.endsWith('.css') ||
		url.endsWith('.svg') ||
		url.endsWith('.woff2')
	)
}

export async function initSocketServer(port: number = 3010) {
	const app = express()
	app.use(express.json())

	const server = http.createServer(app)
	const io = initSocket(server)

	app.use((req, res, next) => {
		if (req.method === 'OPTIONS') {
			next()
			return
		}
		if (isPublicApiPath(req.path) || isSpaAssetPath(req.path)) {
			next()
			return
		}
		if (req.path.startsWith('/api/')) {
			const user = getUserFromSession(parseSessionCookie(req.headers.cookie))
			if (!user) {
				res.status(401).json({ error: 'Not authenticated' })
				return
			}
		}
		next()
	})

	registerAuthRoutes(app)
	registerEditsRoutes(app)
	registerStoryRoutes(app)
	registerRundownScheduleRoutes(app)
	registerNrcsSheetsRoutes(app)

	if (io) {
		type SocketIOHandler = (socket: Socket, io: Server) => void
		const handlers: SocketIOHandler[] = [
			registerCoreConnectionInfoHandlers,
			registerSettingsHandlers,
			registerTypeManifestsHandlers,
			registerSegmentsHandlers,
			registerPlaylistsHandlers,
			registerRundownsHandlers,
			registerPiecesHandlers,
			registerPartsHandlers
		]

		io.use((socket, next) => {
			if (attachSocketAuth(socket as AuthenticatedSocket)) {
				next()
			} else {
				next(new Error('Unauthorized'))
			}
		})

		io.on('connection', (socket) => {
			console.log(`Client connected: ${socket.id}`)

			socket.onAny((event, ...args) => {
				console.log(`Received event: ${event}`, ...args)
			})

			handlers.map((handler: SocketIOHandler) => handler(socket, io))
		})

		app.use(express.static(frontendPath))

		app.get('/favicon.png', (_, res) => {
			res.sendFile(path.join(frontendPath, '../../build/icon.png'))
		})

		app.use((req, res, next) => {
			if (req.method !== 'GET' || req.path.startsWith('/api/')) {
				next()
				return
			}
			res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
				if (err) {
					next(err)
				}
			})
		})

		server.listen(port, () => console.log(`Server running on http://localhost:${port}`))
	} else {
		console.error("Couldn't initialize Socket Server because it's already initialized.")
	}
}
