import { spawn } from 'node:child_process'
import fs from 'fs/promises'
import path from 'path'
import process from 'node:process'
import type { MediaFileEntry } from './interfaces'
import { normalizeBaseUrl, readApplicationSettingsSync } from './settingsResolver'

const DEFAULT_INGEST_MEDIA_ROOT = '../ingest'
const DEFAULT_SUBDIR = 'clips'
const DEFAULT_PREVIEW_BASE_URL = 'http://localhost:3010/demo-assets'
const VIDEO_EXTENSIONS = /\.(mp4|mov|mxf|mkv|webm|m4v|avi)$/i

export function getIngestMediaRoot(): string {
	const settings = readApplicationSettingsSync()
	const configured = settings?.ingestMediaRoot?.trim() || process.env.INGEST_MEDIA_ROOT?.trim()
	if (configured) {
		return path.resolve(configured)
	}
	return path.resolve(process.cwd(), DEFAULT_INGEST_MEDIA_ROOT)
}

export function getPreviewBaseUrl(): string {
	const settings = readApplicationSettingsSync()
	const configured = settings?.previewBaseUrl?.trim() || process.env.PREVIEW_BASE_URL?.trim()
	if (configured) {
		return normalizeBaseUrl(configured)
	}
	return DEFAULT_PREVIEW_BASE_URL
}

function resolveIngestSubdir(rundownId: string, subdir: string): string {
	const ingestRoot = path.resolve(getIngestMediaRoot())
	const targetDir = path.resolve(ingestRoot, 'spravy', rundownId, subdir)

	if (!targetDir.startsWith(ingestRoot + path.sep) && targetDir !== ingestRoot) {
		throw new Error('Invalid media path')
	}

	return targetDir
}

function getRundownMediaFolder(rundownId: string, subdir: string = DEFAULT_SUBDIR): string {
	const safeSubdir = subdir.replace(/[/\\]/g, '')
	return resolveIngestSubdir(rundownId, safeSubdir)
}

function getRelativeRundownMediaFolder(rundownId: string, subdir: string): string {
	const safeSubdir = subdir.replace(/[/\\]/g, '')
	return path.posix.join('spravy', rundownId, safeSubdir)
}

export function resolveMediaAbsolutePath(relativePath: string): string {
	const ingestRoot = path.resolve(getIngestMediaRoot())
	const normalized = relativePath.replace(/^\/+/, '').replace(/\\/g, '/')
	const absolute = path.resolve(ingestRoot, normalized)

	if (!absolute.startsWith(ingestRoot + path.sep) && absolute !== ingestRoot) {
		throw new Error(`Invalid media path: ${relativePath}`)
	}

	return absolute
}

/**
 * Probe clip duration in seconds via ffprobe. Returns undefined when unavailable.
 */
export async function probeMediaDurationSeconds(absolutePath: string): Promise<number | undefined> {
	if (!VIDEO_EXTENSIONS.test(absolutePath)) {
		return undefined
	}

	return new Promise((resolve) => {
		const child = spawn(
			'ffprobe',
			[
				'-v',
				'error',
				'-show_entries',
				'format=duration',
				'-of',
				'default=noprint_wrappers=1:nokey=1',
				absolutePath
			],
			{ stdio: ['ignore', 'pipe', 'ignore'] }
		)

		let stdout = ''
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf8')
		})

		child.on('error', () => resolve(undefined))
		child.on('close', (code) => {
			if (code !== 0) {
				resolve(undefined)
				return
			}
			const seconds = Number.parseFloat(stdout.trim())
			if (!Number.isFinite(seconds) || seconds <= 0) {
				resolve(undefined)
				return
			}
			// Round to 0.1s for editor friendliness.
			resolve(Math.round(seconds * 10) / 10)
		})
	})
}

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
	/** Path relative to ingest root, e.g. spravy/<rundownId>/clips */
	folderPath: string
	/** Absolute filesystem path for the rundown clips folder */
	absoluteFolderPath: string
	folderExists: boolean
	ingestMediaRoot: string
}

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

	const files: MediaFileEntry[] = []

	for (const entry of entries) {
		if (!entry.isFile()) {
			continue
		}

		const filePath = path.join(mediaDir, entry.name)
		const stats = await fs.stat(filePath)
		const relativePath = path.posix.join(relativeFolderPath, entry.name)
		const durationSeconds = await probeMediaDurationSeconds(filePath)

		files.push({
			name: entry.name,
			path: relativePath,
			size: stats.size,
			mtime: stats.mtimeMs,
			durationSeconds,
		})
	}

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
