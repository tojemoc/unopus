import express, { type Response } from 'express'
import fsSync from 'node:fs'
import http from 'http'
import path from 'path'
import { pathToFileURL } from 'node:url'
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
import { registerRundownsRoutes } from './routes/rundowns'
import { registerEditsRoutes } from './routes/edits'
import { registerMediaRoutes } from './routes/media'
import { registerReadinessRoutes } from './routes/readiness'
import { registerAutoNextStateRoutes } from './routes/autoNextState'
import { registerCoreDiagnosticsRoutes } from './routes/coreDiagnostics'
import { registerConfigRoutes } from './routes/config'
import { registerDailyGenerationRoutes } from './routes/dailyGeneration'
import { registerWeatherRoutes } from './routes/weather'
import { registerPresenceHandlers } from './background/api/presence'
import { listCachedPlayoutUpdates } from './background/playoutLockService'
import {
	getBundledGfxTemplatesRoot,
	getGfxEditorCheckout,
	resolveGfxTemplateRoots
} from './background/media'

const frontendPath = path.resolve(__dirname, '../../frontend/dist')

const PUBLIC_API_PREFIXES = ['/api/auth/login']

/** SSE clients of the GFX editor page (`/events`) — get a reload nudge on file changes. */
const gfxEditorEventClients = new Set<Response>()

/**
 * Reload notifier for the GFX editor: template/gfx edits reload the preview
 * iframe, preview-app edits reload the whole page. Non-recursive fs.watch —
 * recursive watching is unsupported on Linux (the demo-assets server polls for
 * the same reason) and both folders are flat.
 */
function registerTemplateFileWatch(repoRoot: string, notify: (reloadPage: boolean) => void): void {
	let timer: NodeJS.Timeout | undefined
	let reloadNeeded = false
	const arm = (dir: string, reloadPage: boolean) => {
		let watcher: fsSync.FSWatcher | undefined
		const attach = () => {
			try {
				watcher = fsSync.watch(dir, (eventType) => {
					if (eventType === 'rename' && !fsSync.existsSync(dir)) {
						// The watched dir was replaced/removed — the watcher's fd sits on
						// the dead inode, so re-arm once the path exists again.
						watcher?.close()
						watcher = undefined
						rearm()
						return
					}
					// Accumulate: a template edit must not cancel a pending page reload.
					reloadNeeded = reloadNeeded || reloadPage
					clearTimeout(timer)
					timer = setTimeout(() => {
						notify(reloadNeeded)
						reloadNeeded = false
					}, 150)
				})
				watcher.on('error', (error) => {
					console.warn(`GFX editor: watch failed for ${dir}`, error)
				})
			} catch (error) {
				console.warn(`GFX editor: cannot watch ${dir}`, error)
			}
		}
		const rearm = () => {
			if (watcher) {
				return
			}
			if (fsSync.existsSync(dir)) {
				attach()
			} else {
				setTimeout(rearm, 500)
			}
		}
		attach()
	}
	arm(path.join(repoRoot, 'template', 'gfx'), false)
	arm(path.join(repoRoot, 'preview'), true)
}

/**
 * Check if a URL path is a public API endpoint (no authentication required).
 */
function isPublicApiPath(url: string | undefined): boolean {
	if (!url) {
		return false
	}
	// Match Express's case-insensitive, trailing-slash-tolerant routing, or
	// /API/auth/login would 401 while the login handler would have matched.
	const lower = url.toLowerCase()
	return PUBLIC_API_PREFIXES.some(
		(prefix) => lower === prefix || lower === `${prefix}/` || lower.startsWith(`${prefix}?`)
	)
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
		// Express routes match case-insensitively — the guard must too, or
		// /API/template-settings would skip the session check.
		if (req.path.toLowerCase().startsWith('/api/')) {
			const user = getUserFromSession(parseSessionCookie(req.headers.cookie))
			if (!user) {
				res.status(401).json({ error: 'Not authenticated' })
				return
			}
		}
		next()
	})

	registerAuthRoutes(app)
	registerRundownsRoutes(app)
	registerEditsRoutes(app)
	registerMediaRoutes(app)
	registerReadinessRoutes(app)
	registerAutoNextStateRoutes(app)
	registerCoreDiagnosticsRoutes(app)
	registerConfigRoutes(app)
	registerDailyGenerationRoutes(app)
	registerWeatherRoutes(app)

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

			// Replay last known Sofie playout positions so late joiners get ON AIR / System locks.
			for (const update of listCachedPlayoutUpdates()) {
				socket.emit('playout:update', update)
			}
		})

		app.use('/demo-assets', (req, res, next) => {
			res.setHeader('Cache-Control', 'no-cache')
			next()
		})

		app.get('/demo-assets/_gfx-preview-bridge.html', (_req, res) => {
			res.sendFile(path.join(getBundledGfxTemplatesRoot(), '_gfx-preview-bridge.html'))
		})

		// sofie-demo-assets checkout: serve the standalone GFX editor (`/preview/`),
		// its templates and fonts same-origin, and proxy the template-settings API.
		// Probed once here — the mounted checkout is the one /api/config advertises.
		const demoAssetsRepoRoot = getGfxEditorCheckout()
		if (demoAssetsRepoRoot) {
			console.log(`GFX editor (sofie-demo-assets): ${demoAssetsRepoRoot}`)
			app.use('/preview', express.static(path.join(demoAssetsRepoRoot, 'preview')))
			app.use('/template', express.static(path.join(demoAssetsRepoRoot, 'template')))
			app.use('/fonts', express.static(path.join(demoAssetsRepoRoot, 'public', 'fonts')))
			app.get('/events', (req, res) => {
				res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
				res.write(': connected\n\n')
				gfxEditorEventClients.add(res)
				req.on('close', () => gfxEditorEventClients.delete(res))
			})
			registerTemplateFileWatch(demoAssetsRepoRoot, (reloadPage) => {
				for (const client of gfxEditorEventClients) {
					client.write(`data: ${JSON.stringify({ reloadPage })}\n\n`)
				}
			})
			// The save/restore implementation lives in the demo-assets repo (ESM) —
			// same API contract as the standalone preview server. `new Function` keeps
			// a native dynamic import: TS downlevels import() to require() under
			// CommonJS, which fails if the .mjs ever uses top-level await.
			const templateSettingsModule = pathToFileURL(
				path.join(demoAssetsRepoRoot, 'scripts', 'template-settings.mjs')
			).href
			type TemplateSettingsModule = {
				readSettings: (root: string, template: string) => Promise<unknown>
				saveSettings: (root: string, request: unknown) => Promise<unknown>
			}
			const loadTemplateSettings = () =>
				new Function('specifier', 'return import(specifier)')(
					templateSettingsModule
				) as Promise<TemplateSettingsModule>
			app.get('/api/template-settings', async (req, res) => {
				try {
					const { readSettings } = await loadTemplateSettings()
					const template = typeof req.query.template === 'string' ? req.query.template : ''
					res.json(await readSettings(demoAssetsRepoRoot, template))
				} catch (error) {
					const err = error as Error & { status?: number }
					res.status(err.status || 500).json({ error: err.message })
				}
			})
			app.post('/api/template-settings', async (req, res) => {
				try {
					const { saveSettings } = await loadTemplateSettings()
					res.json(await saveSettings(demoAssetsRepoRoot, req.body))
				} catch (error) {
					const err = error as Error & { status?: number }
					res.status(err.status || 500).json({ error: err.message })
				}
			})
		}

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

		server.listen(port, () => {
			console.log(`Server running on http://localhost:${port}`)
			void import('./background/media.js').then(async ({ isFfprobeAvailable }) => {
				const available = await isFfprobeAvailable()
				if (available) {
					console.log('ffprobe: available (media Source length / On air seeding enabled)')
				} else {
					console.warn(
						'ffprobe: NOT FOUND on PATH — media picker cannot probe clip length. ' +
							'Install ffmpeg in the image/host (Docker: apt package ffmpeg).'
					)
				}
			})
		})
	} else {
		console.error("Couldn't initialize Socket Server because it's already initialized.")
	}
}
