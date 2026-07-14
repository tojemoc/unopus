import fs from 'fs/promises'
import path from 'path'
import {
	ManifestFieldType,
	type MediaRequirement,
	type Piece,
	type PieceReadiness,
	type RundownReadiness,
	type TypeManifest
} from './interfaces'
import { getIngestMediaRoot } from './media'
import { findTypeManifest } from './manifestMaterialize'
import { resolveSourceEnabled, trimSourceText } from './sourcePayload'

const CEF_TEMPLATE_VIDEO = /\.(mp4|mov|m4v|mxf)$/i
const PATH_LOOKUP_CONCURRENCY = 8

function resolveMediaAbsolutePath(relativePath: string): string {
	const ingestRoot = path.resolve(getIngestMediaRoot())
	const normalized = relativePath.replace(/^\/+/, '').replace(/\\/g, '/')
	const absolute = path.resolve(ingestRoot, normalized)

	if (!absolute.startsWith(ingestRoot + path.sep) && absolute !== ingestRoot) {
		throw new Error(`Invalid media path: ${relativePath}`)
	}

	return absolute
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		const stats = await fs.stat(filePath)
		return stats.isFile()
	} catch (error) {
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			(error as NodeJS.ErrnoException).code === 'ENOENT'
		) {
			return false
		}
		throw error
	}
}

type PathLookupContext = {
	checkFile: (filePath: string) => Promise<boolean>
}

function createPathLookupContext(concurrency = PATH_LOOKUP_CONCURRENCY): PathLookupContext {
	const cache = new Map<string, Promise<boolean>>()
	let active = 0
	const waitQueue: Array<() => void> = []

	const acquire = () =>
		new Promise<void>((resolve) => {
			if (active < concurrency) {
				active += 1
				resolve()
				return
			}
			waitQueue.push(() => {
				active += 1
				resolve()
			})
		})

	const release = () => {
		active -= 1
		const next = waitQueue.shift()
		if (next) {
			next()
		}
	}

	return {
		checkFile(filePath: string): Promise<boolean> {
			const cached = cache.get(filePath)
			if (cached) {
				return cached
			}

			const pending = (async () => {
				await acquire()
				try {
					return await fileExists(filePath)
				} finally {
					release()
				}
			})()

			cache.set(filePath, pending)
			return pending
		}
	}
}

function collectMediaRequirements(
	piece: Piece,
	manifest: TypeManifest | undefined
): MediaRequirement[] {
	if (!manifest?.payload?.length) {
		return []
	}

	const requirements: MediaRequirement[] = []

	for (const field of manifest.payload) {
		if (field.type !== ManifestFieldType.MediaPick) {
			continue
		}

		const rawValue = piece.payload?.[field.id]
		const mediaPath = typeof rawValue === 'string' ? rawValue.trim() : ''

		if (!mediaPath) {
			requirements.push({
				fieldId: field.id,
				path: '',
				ready: false,
				reason: 'No media assigned'
			})
			continue
		}

		requirements.push({
			fieldId: field.id,
			path: mediaPath,
			ready: false,
			requiresCefWebm: field.id === 'iluFile'
		})
	}

	const hasSourceToggle = manifest.payload.some((field) => field.id === 'sourceEnabled')
	const sourceText = trimSourceText(piece.payload?.source)
	if (hasSourceToggle && resolveSourceEnabled(piece.payload?.sourceEnabled, sourceText)) {
		if (!sourceText) {
			requirements.push({
				fieldId: 'source',
				path: '',
				ready: false,
				reason: 'Source is enabled but empty — pill will not show on air'
			})
		}
	}

	return requirements
}

async function evaluateRequirement(
	requirement: MediaRequirement,
	pathLookup: PathLookupContext
): Promise<MediaRequirement> {
	if (!requirement.path) {
		return requirement
	}

	try {
		const masterPath = resolveMediaAbsolutePath(requirement.path)
		const masterExists = await pathLookup.checkFile(masterPath)

		if (!masterExists) {
			return {
				...requirement,
				ready: false,
				reason: 'File missing on ingest'
			}
		}

		if (requirement.requiresCefWebm && CEF_TEMPLATE_VIDEO.test(requirement.path)) {
			const webmPath = masterPath.replace(CEF_TEMPLATE_VIDEO, '.webm')
			const webmExists = await pathLookup.checkFile(webmPath)

			if (!webmExists) {
				return {
					...requirement,
					ready: false,
					reason: 'WebM sibling missing for template playback'
				}
			}
		}

		return {
			...requirement,
			ready: true,
			reason: undefined
		}
	} catch (error) {
		return {
			...requirement,
			ready: false,
			reason: error instanceof Error ? error.message : 'Invalid media path'
		}
	}
}

export async function evaluatePieceReadiness(
	piece: Piece,
	manifests: TypeManifest[],
	pathLookup: PathLookupContext
): Promise<PieceReadiness> {
	const manifest = findTypeManifest(manifests, piece.pieceType)

	if (!manifest) {
		return {
			pieceId: piece.id,
			partId: piece.partId,
			ready: false,
			requirements: [
				{
					fieldId: '_manifest',
					path: '',
					ready: false,
					reason: `Piece type manifest not found: ${piece.pieceType}`
				}
			]
		}
	}

	const requirements = collectMediaRequirements(piece, manifest)

	if (!requirements.length) {
		return {
			pieceId: piece.id,
			partId: piece.partId,
			ready: true,
			requirements: []
		}
	}

	const evaluated = await Promise.all(
		requirements.map((requirement) => evaluateRequirement(requirement, pathLookup))
	)

	return {
		pieceId: piece.id,
		partId: piece.partId,
		ready: evaluated.every((item) => item.ready),
		requirements: evaluated
	}
}

export async function evaluateRundownReadiness(
	pieces: Piece[],
	manifests: TypeManifest[]
): Promise<RundownReadiness> {
	const pathLookup = createPathLookupContext()
	const pieceResults = await Promise.all(
		pieces.map((piece) => evaluatePieceReadiness(piece, manifests, pathLookup))
	)

	const piecesById: Record<string, PieceReadiness> = {}
	const partsById: Record<
		string,
		{ ready: boolean; mediaPieceCount: number; readyMediaPieceCount: number }
	> = {}

	for (const result of pieceResults) {
		piecesById[result.pieceId] = result

		const partStats = partsById[result.partId] ?? {
			ready: true,
			mediaPieceCount: 0,
			readyMediaPieceCount: 0
		}

		if (result.requirements.length > 0) {
			partStats.mediaPieceCount += 1
			if (result.ready) {
				partStats.readyMediaPieceCount += 1
			}
			partStats.ready = partStats.ready && result.ready
		}

		partsById[result.partId] = partStats
	}

	return {
		pieces: piecesById,
		parts: partsById,
		summary: {
			totalMediaPieces: pieceResults.filter((item) => item.requirements.length > 0).length,
			readyMediaPieces: pieceResults.filter(
				(item) => item.requirements.length > 0 && item.ready
			).length
		}
	}
}
