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
import { registerMediaRoutes } from './routes/media'
import { registerReadinessRoutes } from './routes/readiness'
import { registerCoreDiagnosticsRoutes } from './routes/coreDiagnostics'
import { registerConfigRoutes } from './routes/config'
import { registerDailyGenerationRoutes } from './routes/dailyGeneration'
import { registerPresenceHandlers } from './background/api/presence'
import { resolveGfxTemplateRoots } from './background/media'

const frontendPath = path.resolve(__dirname, '../../frontend/dist')

const PUBLIC_API_PREFIXES = ['/api/auth/login']

/**
 * Check if a URL path is a public API endpoint (no authentication required).
 */
function isPublicApiPath(url: string | undefined): boolean {
	if (!url) {
		return false
	}
	return PUBLIC_API_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}?`))
}

/**
 * Check if a URL path is a static SPA asset (should not require authentication).
 */
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

/**
 * Initialize the Express + Socket.IO server with all routes and handlers.
 */
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
	registerMediaRoutes(app)
	registerReadinessRoutes(app)
	registerCoreDiagnosticsRoutes(app)
	registerConfigRoutes(app)
	registerDailyGenerationRoutes(app)

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
			registerPartsHandlers,
			registerPresenceHandlers
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

		app.use('/demo-assets', (req, res, next) => {
			res.setHeader('Cache-Control', 'no-cache')
			next()
		})

		const gfxTemplateRoots = resolveGfxTemplateRoots()
		if (gfxTemplateRoots.length === 0) {
			console.warn('GFX preview: no template roots found — /demo-assets will 404')
		} else {
			console.log(`GFX preview templates (${gfxTemplateRoots.length} root(s)):`)
			for (const root of gfxTemplateRoots) {
				console.log(`  • ${root}`)
			}
			for (let i = 0; i < gfxTemplateRoots.length - 1; i++) {
				app.use('/demo-assets', express.static(gfxTemplateRoots[i], { fallthrough: true }))
			}
			app.use(
				'/demo-assets',
				express.static(gfxTemplateRoots[gfxTemplateRoots.length - 1], { fallthrough: false })
			)
		}
		app.use(express.static(frontendPath))

		app.get('/favicon.png', (_, res) => {
			res.sendFile(path.join(frontendPath, '../../build/icon.png'))
		})

		app.use((req, res, next) => {
			if (req.method !== 'GET' || req.path.startsWith('/api/')) {
				next()
				return
			}
			if (req.path === '/demo-assets' || req.path.startsWith('/demo-assets/')) {
				res.status(404).type('text/plain').send('GFX preview template not found')
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
