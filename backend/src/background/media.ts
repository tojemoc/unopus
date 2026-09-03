import { spawn } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'path'
import process from 'node:process'
import type { MediaFileEntry } from './interfaces'
import { isValidPreviewBaseUrl, normalizeBaseUrl, readApplicationSettingsSync } from './settingsResolver'

const DEFAULT_INGEST_MEDIA_ROOT = '../ingest'
const DEFAULT_SUBDIR = 'clips'
const DEFAULT_PREVIEW_BASE_URL = '/demo-assets'
/** Subfolder under ingest media root for copied GFX HTML templates (NAS-friendly). */
export const GFX_TEMPLATES_INGEST_SUBDIR = 'gfx-templates'
const VIDEO_EXTENSIONS = /\.(mp4|mov|mxf|mkv|webm|m4v|avi)$/i

/**
 * Get the absolute path to the ingest media root directory.
 * Checks application settings and environment variables, falling back to default.
 */
export function getIngestMediaRoot(): string {
	const settings = readApplicationSettingsSync()
	const configured = settings?.ingestMediaRoot?.trim() || process.env.INGEST_MEDIA_ROOT?.trim()
	if (configured) {
		return path.resolve(configured)
	}
	return path.resolve(process.cwd(), DEFAULT_INGEST_MEDIA_ROOT)
}

/**
 * Get the base URL for media preview/playback.
 * Checks application settings and environment variables, falling back to default.
 *
 * Same-origin `/demo-assets` is preferred. Absolute `http://localhost:…` values stored in
 * older installs are rewritten to `/demo-assets` so browsers load templates from the app host.
 */
export function getPreviewBaseUrl(): string {
	const settings = readApplicationSettingsSync()
	const configured = settings?.previewBaseUrl?.trim() || process.env.PREVIEW_BASE_URL?.trim()
	if (configured) {
		const normalized = normalizeBaseUrl(configured)
		if (normalized && isValidPreviewBaseUrl(normalized)) {
			return normalizePreviewBaseUrlForClient(normalized)
		}
	}
	return DEFAULT_PREVIEW_BASE_URL
}

/** Bundled stub templates shipped with the app (demo-assets/ copied into frontend/dist on build). */
export function getBundledGfxTemplatesRoot(): string {
	const frontendDist = path.resolve(process.cwd(), 'frontend/dist/demo-assets')
	if (fsSync.existsSync(frontendDist)) {
		return frontendDist
	}
	// backend/dist/background/media.js → ../../../demo-assets
	const fromBackendDist = path.resolve(__dirname, '../../../demo-assets')
	if (fsSync.existsSync(fromBackendDist)) {
		return fromBackendDist
	}
	return path.resolve(process.cwd(), 'demo-assets')
}

/**
 * Ordered GFX template roots — first match wins when serving `/demo-assets/…`.
 *
 * Flat Caspar templates: `gfx/{name}.html`, `{name}.html`, or `{name}/index.html` stubs.
 *
 * 1. `GFX_TEMPLATES_ROOT` env (Docker bind mount to sofie-demo-assets, etc.)
 * 2. `{INGEST_MEDIA_ROOT}/gfx-templates/` (copy HTML templates onto the NAS ingest share)
 * 3. Bundled demo-assets stubs in the app image
 */
export function resolveGfxTemplateRoots(): string[] {
	const roots: string[] = []
	const seen = new Set<string>()

	const addRoot = (candidate: string | undefined) => {
		if (!candidate?.trim()) {
			return
		}
		const resolved = path.resolve(candidate.trim())
		if (seen.has(resolved) || !fsSync.existsSync(resolved)) {
			return
		}
		roots.push(resolved)
		seen.add(resolved)
	}

	addRoot(process.env.GFX_TEMPLATES_ROOT?.trim())
	addRoot(path.join(getIngestMediaRoot(), GFX_TEMPLATES_INGEST_SUBDIR))
	addRoot(getBundledGfxTemplatesRoot())

	return roots
}

function normalizePreviewBaseUrlForClient(url: string): string {
	if (url.startsWith('/')) {
		return url
	}
	try {
		const parsed = new URL(url)
		const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
		if (isLocalhost && parsed.pathname.replace(/\/+$/, '') === '/demo-assets') {
			return DEFAULT_PREVIEW_BASE_URL
		}
	} catch {
		// keep original
	}
	return url
}

/**
 * Resolve and validate a subdirectory path within the ingest root.
 * Throws if the path attempts directory traversal.
 */
function resolveIngestSubdir(subdir: string): string {
	const ingestRoot = path.resolve(getIngestMediaRoot())
	const safeSubdir = subdir.replace(/[/\\]/g, '')
	const targetDir = path.resolve(ingestRoot, safeSubdir)

	if (!targetDir.startsWith(ingestRoot + path.sep) && targetDir !== ingestRoot) {
		throw new Error('Invalid media path')
	}

	return targetDir
}

/**
 * Get the absolute path to the media folder for a rundown.
 */
function getRundownMediaFolder(_rundownId: string, subdir: string = DEFAULT_SUBDIR): string {
	return resolveIngestSubdir(subdir)
}

/**
 * Get the relative media folder path (sanitized subdirectory name).
 */
function getRelativeRundownMediaFolder(_rundownId: string, subdir: string): string {
	const safeSubdir = subdir.replace(/[/\\]/g, '')
	return safeSubdir
}

/**
 * Convert an ingest-relative path to absolute filesystem path.
 * Validates against directory traversal attacks.
 */
export function resolveMediaAbsolutePath(relativePath: string): string {
	const ingestRoot = path.resolve(getIngestMediaRoot())
	const normalized = relativePath.replace(/^\/+/, '').replace(/\\/g, '/')
	const absolute = path.resolve(ingestRoot, normalized)

	if (!absolute.startsWith(ingestRoot + path.sep) && absolute !== ingestRoot) {
		throw new Error(`Invalid media path: ${relativePath}`)
	}

	return absolute
}

const FFPROBE_TIMEOUT_MS = 10_000
const FFPROBE_CONCURRENCY = 4
const DURATION_CACHE_MAX = 512
const DURATION_CACHE_TTL_MS = 30 * 60 * 1000

type DurationCacheEntry = {
	mtime: number
	size: number
	durationSeconds: number | undefined
	cachedAt: number
}

/** Cache probed durations across listRundownMedia polls (keyed by ingest-relative path). */
const durationSecondsCache = new Map<string, DurationCacheEntry>()
/** In-flight probes so overlapping polls reuse the same ffprobe for a path. */
const inFlightDurationProbes = new Map<string, Promise<number | undefined>>()

let activeProbeCount = 0
const probeWaitQueue: Array<() => void> = []

/**
 * Execute an ffprobe operation with concurrency limiting.
 * Waits in queue if max concurrent probes are already running.
 */
async function withFfprobeSlot<T>(run: () => Promise<T>): Promise<T> {
	if (activeProbeCount >= FFPROBE_CONCURRENCY) {
		await new Promise<void>((resolve) => {
			probeWaitQueue.push(resolve)
		})
	}
	activeProbeCount++
	try {
		return await run()
	} finally {
		activeProbeCount--
		const next = probeWaitQueue.shift()
		if (next) {
			next()
		}
	}
}

/**
 * Add or update a duration cache entry using LRU eviction.
 */
function setDurationCacheEntry(relativePath: string, entry: DurationCacheEntry): void {
	// LRU: re-insert so the entry becomes the newest.
	durationSecondsCache.delete(relativePath)
	durationSecondsCache.set(relativePath, entry)
	while (durationSecondsCache.size > DURATION_CACHE_MAX) {
		const oldest = durationSecondsCache.keys().next().value
		if (oldest === undefined) {
			break
		}
		durationSecondsCache.delete(oldest)
	}
}

/**
 * Retrieve a cached duration entry if valid (matches mtime/size and not expired).
 */
function readDurationCacheEntry(
	relativePath: string,
	mtime: number,
	size: number
): DurationCacheEntry | undefined {
	const cached = durationSecondsCache.get(relativePath)
	if (!cached) {
		return undefined
	}
	if (Date.now() - cached.cachedAt > DURATION_CACHE_TTL_MS) {
		durationSecondsCache.delete(relativePath)
		return undefined
	}
	if (cached.mtime !== mtime || cached.size !== size) {
		return undefined
	}
	setDurationCacheEntry(relativePath, cached)
	return cached
}

/**
 * Remove stale or deleted file entries from the duration cache.
 */
function pruneDurationCache(liveRelativePaths: Set<string>, folderPrefix: string): void {
	const folderRoot = folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`
	const now = Date.now()
	for (const [key, entry] of durationSecondsCache) {
		const expired = now - entry.cachedAt > DURATION_CACHE_TTL_MS
		const inThisFolder = key.startsWith(folderRoot)
		const removed = inThisFolder && !liveRelativePaths.has(key)
		if (expired || removed) {
			durationSecondsCache.delete(key)
		}
	}
}

/**
 * Probe media duration with caching and in-flight deduplication.
 */
async function probeDurationCached(
	relativePath: string,
	filePath: string,
	mtime: number,
	size: number
): Promise<number | undefined> {
	const cached = readDurationCacheEntry(relativePath, mtime, size)
	if (cached) {
		return cached.durationSeconds
	}

	const existing = inFlightDurationProbes.get(relativePath)
	if (existing) {
		return existing
	}

	const probePromise = withFfprobeSlot(() => probeMediaDurationSeconds(filePath))
		.then((durationSeconds) => {
			setDurationCacheEntry(relativePath, {
				mtime,
				size,
				durationSeconds,
				cachedAt: Date.now()
			})
			return durationSeconds
		})
		.finally(() => {
			inFlightDurationProbes.delete(relativePath)
		})

	inFlightDurationProbes.set(relativePath, probePromise)
	return probePromise
}

/**
 * Pick a playable duration (seconds) from ffprobe JSON.
 *
 * Container `format.duration` / stream `duration` tags are often wrong on NLE /
 * phone exports (mvhd lies while samples are longer). Prefer the longest of:
 * - format.duration
 * - per-stream duration
 * - video `nb_frames / avg_frame_rate` when both are present
 *
 * That matches what Chromium's `<video>` typically reports for the same file.
 */
export function pickDurationSecondsFromFfprobeJson(probe: {
	format?: { duration?: string | number }
	streams?: Array<{
		codec_type?: string
		duration?: string | number
		nb_frames?: string | number
		avg_frame_rate?: string
		r_frame_rate?: string
	}>
}): number | undefined {
	const candidates: number[] = []

	const push = (raw: unknown) => {
		const seconds =
			typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : Number.NaN
		if (Number.isFinite(seconds) && seconds > 0) {
			candidates.push(seconds)
		}
	}

	push(probe.format?.duration)

	for (const stream of probe.streams ?? []) {
		push(stream.duration)
		const framesRaw = stream.nb_frames
		const frames =
			typeof framesRaw === 'number'
				? framesRaw
				: typeof framesRaw === 'string'
					? Number.parseInt(framesRaw, 10)
					: Number.NaN
		if (!Number.isFinite(frames) || frames <= 0) {
			continue
		}
		const rate = parseFfprobeFrameRate(stream.avg_frame_rate) ?? parseFfprobeFrameRate(stream.r_frame_rate)
		if (rate !== undefined) {
			candidates.push(frames / rate)
		}
	}

	if (candidates.length === 0) {
		return undefined
	}

	const seconds = Math.max(...candidates)
	// Round to 0.1s for editor friendliness.
	return Math.round(seconds * 10) / 10
}

/** Parse ffprobe `N/D` rates; reject missing, non-finite, and `0/0`. */
function parseFfprobeFrameRate(rateStr: string | undefined): number | undefined {
	if (typeof rateStr !== 'string' || !rateStr.includes('/')) {
		return undefined
	}
	const [numStr, denStr] = rateStr.split('/')
	const num = Number.parseFloat(numStr)
	const den = Number.parseFloat(denStr)
	if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0 || num <= 0) {
		return undefined
	}
	return num / den
}

/**
 * Probe clip duration in seconds via ffprobe. Returns undefined when unavailable.
 */
export async function probeMediaDurationSeconds(absolutePath: string): Promise<number | undefined> {
	if (!VIDEO_EXTENSIONS.test(absolutePath)) {
		return undefined
	}

	return new Promise((resolve) => {
		let settled = false
		let timer: ReturnType<typeof setTimeout> | undefined
		const finish = (value: number | undefined) => {
			if (settled) {
				return
			}
			settled = true
			if (timer !== undefined) {
				clearTimeout(timer)
			}
			resolve(value)
		}

		const child = spawn(
			'ffprobe',
			[
				'-v',
				'error',
				'-show_entries',
				'format=duration:stream=duration,nb_frames,avg_frame_rate,r_frame_rate,codec_type',
				'-of',
				'json',
				absolutePath
			],
			{ stdio: ['ignore', 'pipe', 'ignore'] }
		)

		timer = setTimeout(() => {
			child.kill('SIGKILL')
			finish(undefined)
		}, FFPROBE_TIMEOUT_MS)

		let stdout = ''
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf8')
		})

		child.on('error', () => finish(undefined))
		child.on('close', (code) => {
			if (code !== 0) {
				finish(undefined)
				return
			}
			try {
				const parsed = JSON.parse(stdout) as Parameters<typeof pickDurationSecondsFromFfprobeJson>[0]
				finish(pickDurationSecondsFromFfprobeJson(parsed))
			} catch {
				finish(undefined)
			}
		})
	})
}

/**
 * Probe duration for a media file specified by ingest-relative path.
 */
export async function probeRelativeMediaDurationSeconds(
	relativePath: string
): Promise<number | undefined> {
	const absolute = resolveMediaAbsolutePath(relativePath)
	try {
		const stats = await fs.stat(absolute)
		if (!stats.isFile()) {
			return undefined
		}
	} catch {
		return undefined
	}
	return probeMediaDurationSeconds(absolute)
}

export interface RundownMediaListing {
	files: MediaFileEntry[]
	/** Path relative to ingest root, e.g. clips */
	folderPath: string
	/** Absolute filesystem path for the media subfolder */
	absoluteFolderPath: string
	folderExists: boolean
	ingestMediaRoot: string
}

/**
 * List all media files in the rundown's ingest folder with probed durations.
 */
export async function listRundownMedia(
	rundownId: string,
	subdir: string = DEFAULT_SUBDIR
): Promise<RundownMediaListing> {
	const mediaDir = getRundownMediaFolder(rundownId, subdir)
	const relativeFolderPath = getRelativeRundownMediaFolder(rundownId, subdir)
	const ingestMediaRoot = getIngestMediaRoot()

	let entries
	let folderExists = true
	try {
		entries = await fs.readdir(mediaDir, { withFileTypes: true })
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return {
				files: [],
				folderPath: relativeFolderPath,
				absoluteFolderPath: mediaDir,
				folderExists: false,
				ingestMediaRoot,
			}
		}
		throw error
	}

	const fileInfos: Array<{
		name: string
		relativePath: string
		filePath: string
		size: number
		mtime: number
	}> = []

	for (const entry of entries) {
		if (!entry.isFile()) {
			continue
		}

		const filePath = path.join(mediaDir, entry.name)
		const stats = await fs.stat(filePath)
		const relativePath = path.posix.join(relativeFolderPath, entry.name)
		fileInfos.push({
			name: entry.name,
			relativePath,
			filePath,
			size: stats.size,
			mtime: stats.mtimeMs
		})
	}

	const liveRelativePaths = new Set(fileInfos.map((info) => info.relativePath))
	pruneDurationCache(liveRelativePaths, relativeFolderPath)

	const files: MediaFileEntry[] = await Promise.all(
		fileInfos.map(async (info) => {
			const durationSeconds = await probeDurationCached(
				info.relativePath,
				info.filePath,
				info.mtime,
				info.size
			)

			return {
				name: info.name,
				path: info.relativePath,
				size: info.size,
				mtime: info.mtime,
				durationSeconds
			}
		})
	)

	files.sort((a, b) => a.name.localeCompare(b.name))

	return {
		files,
		folderPath: relativeFolderPath,
		absoluteFolderPath: mediaDir,
		folderExists,
		ingestMediaRoot,
	}
}

/** Create the rundown ingest clips folder (and parents) if missing. */
export async function ensureRundownMediaFolder(
	rundownId: string,
	subdir: string = DEFAULT_SUBDIR
): Promise<RundownMediaListing> {
	const mediaDir = getRundownMediaFolder(rundownId, subdir)
	await fs.mkdir(mediaDir, { recursive: true })
	return listRundownMedia(rundownId, subdir)
}
