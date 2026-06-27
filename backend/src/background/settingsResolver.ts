import { db } from './db'
import type { ApplicationSettings, DBSettings } from './interfaces'

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

export function normalizeBaseUrl(url: string): string {
	return url.trim().replace(/\/+$/, '')
}

export function isValidHttpUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	} catch {
		return false
	}
}
