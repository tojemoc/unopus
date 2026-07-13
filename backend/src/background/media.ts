import fs from 'fs/promises'
import path from 'path'
import process from 'node:process'
import type { MediaFileEntry } from './interfaces'
import { normalizeBaseUrl, readApplicationSettingsSync } from './settingsResolver'

const DEFAULT_INGEST_MEDIA_ROOT = '../ingest'
const DEFAULT_SUBDIR = 'clips'
const DEFAULT_PREVIEW_BASE_URL = 'http://localhost:3010/demo-assets'

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

export interface RundownMediaListing {
	files: MediaFileEntry[]
	folderPath: string
	folderExists: boolean
}

export async function listRundownMedia(
	rundownId: string,
	subdir: string = DEFAULT_SUBDIR
): Promise<RundownMediaListing> {
	const mediaDir = getRundownMediaFolder(rundownId, subdir)
	const relativeFolderPath = getRelativeRundownMediaFolder(rundownId, subdir)

	let entries
	let folderExists = true
	try {
		entries = await fs.readdir(mediaDir, { withFileTypes: true })
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return {
				files: [],
				folderPath: relativeFolderPath,
				folderExists: false,
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

		files.push({
			name: entry.name,
			path: relativePath,
			size: stats.size,
			mtime: stats.mtimeMs
		})
	}

	files.sort((a, b) => a.name.localeCompare(b.name))

	return {
		files,
		folderPath: relativeFolderPath,
		folderExists,
	}
}
