import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ManifestFieldType, TypeManifest, TypeManifestEntity } from './interfaces'

export const defaultRundownManifest: TypeManifest = {
	id: 'rundown',
	entityType: TypeManifestEntity.Rundown,
	name: 'Default Rundown Manifest',
	shortName: 'RD',
	colour: '#000000',
	payload: []
}

function resolveManifestPath(filename: string): string {
	const candidates = [
		// Explicit override (CI / standalone checkout)
		process.env.SOFIE_MEGAREPO_ASSETS ? join(process.env.SOFIE_MEGAREPO_ASSETS, filename) : '',
		// Nested in tojemoc/sofie megarepo: rundown-editor/backend/{src|dist}/background → ../../../../assets
		join(__dirname, '../../../../assets', filename)
	].filter(Boolean)

	for (const filePath of candidates) {
		if (existsSync(filePath)) return filePath
	}

	const legacyNearDist = join(__dirname, '../assets', filename)
	const legacyRepoRoot = join(__dirname, '../../../assets', filename)
	throw new Error(
		`Manifest file not found: ${filename}. Canonical copy lives in the sofie megarepo at assets/. ` +
			`Set SOFIE_MEGAREPO_ASSETS or run nested under sofie/rundown-editor/. Tried:\n` +
			candidates.map((p) => `  - ${p}`).join('\n') +
			`\n  - ${legacyNearDist} (legacy packaged path; no longer used)` +
			`\n  - ${legacyRepoRoot} (legacy in-repo path; no longer used)`
	)
}

function loadManifestJson(filename: string): TypeManifest[] {
	const filePath = resolveManifestPath(filename)
	const raw = readFileSync(filePath, 'utf-8')
	const parsed = JSON.parse(raw) as TypeManifest[]
	return parsed.map((manifest) => ({
		...manifest,
		payload: manifest.payload ?? []
	}))
}

export const PIECE_TYPE_MANIFESTS = loadManifestJson('sofie-rundown-editor-piece-types.json')
export const PART_TYPE_MANIFESTS = loadManifestJson('sofie-rundown-editor-part-types.json')
export const SEGMENT_TYPE_MANIFESTS = loadManifestJson('sofie-rundown-editor-segment-types.json')

export const TYPE_MANIFESTS: TypeManifest[] = [
	...PIECE_TYPE_MANIFESTS,
	...PART_TYPE_MANIFESTS,
	...SEGMENT_TYPE_MANIFESTS
]

// Re-export for any code that still references ManifestFieldType from manifest module
export { ManifestFieldType }
