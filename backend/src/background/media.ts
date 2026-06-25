import fs from 'fs/promises'
import path from 'path'
import type { MediaFileEntry } from './interfaces'

const DEFAULT_INGEST_MEDIA_ROOT = '../ingest'
const DEFAULT_SUBDIR = 'clips'

export function getIngestMediaRoot(): string {
	const configured = process.env.INGEST_MEDIA_ROOT?.trim()
	if (configured) {
		return path.resolve(configured)
	}
	return path.resolve(process.cwd(), DEFAULT_INGEST_MEDIA_ROOT)
}

export function getPreviewBaseUrl(): string {
	return process.env.PREVIEW_BASE_URL ?? 'http://localhost:3010/demo-assets'
}

function resolveIngestSubdir(rundownId: string, subdir: string): string {
	const ingestRoot = path.resolve(getIngestMediaRoot())
	const targetDir = path.resolve(ingestRoot, 'spravy', rundownId, subdir)

	if (!targetDir.startsWith(ingestRoot + path.sep) && targetDir !== ingestRoot) {
		throw new Error('Invalid media path')
	}

	return targetDir
}

export async function listRundownMedia(
	rundownId: string,
	subdir: string = DEFAULT_SUBDIR
): Promise<MediaFileEntry[]> {
	const safeSubdir = subdir.replace(/[/\\]/g, '')
	const mediaDir = resolveIngestSubdir(rundownId, safeSubdir)

	let entries
	try {
		entries = await fs.readdir(mediaDir, { withFileTypes: true })
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return []
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
		const relativePath = path.posix.join('spravy', rundownId, safeSubdir, entry.name)

		files.push({
			name: entry.name,
			path: relativePath,
			size: stats.size,
			mtime: stats.mtimeMs
		})
	}

	files.sort((a, b) => a.name.localeCompare(b.name))

	return files
}
