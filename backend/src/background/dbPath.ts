import fs from 'fs'
import path from 'path'

/**
 * Directory for SQLite and other persistent data.
 * In Docker, set DATA_DIR=/app/data (see docker-compose.yml).
 */
export function resolveDataDir(): string {
	const configured = process.env.DATA_DIR?.trim()
	if (configured) {
		return path.resolve(configured)
	}

	// backend workspace: ../data; repo root yarn start: same via backend cwd
	return path.resolve(process.cwd(), '../data')
}

export function resolveDbFilePath(): string {
	return path.join(resolveDataDir(), 'data.db')
}

export function ensureDataDir(): void {
	const dataDir = resolveDataDir()
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true })
	}
}
