import { db } from './db'
import type { ApplicationSettings, DBSettings } from './interfaces'

export {
	isValidHttpUrl,
	isValidPreviewBaseUrl,
	normalizeBaseUrl
} from './urlHelpers'

export function readApplicationSettingsSync(): ApplicationSettings | undefined {
	try {
		const stmt = db.prepare(`
			SELECT document
			FROM settings
			WHERE id = 'settings'
			LIMIT 1;
		`)
		const row = stmt.get() as DBSettings | undefined
		if (!row) return undefined
		return JSON.parse(row.document) as ApplicationSettings
	} catch {
		return undefined
	}
}
