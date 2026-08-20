import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const repoRoot = path.resolve(backendRoot, '..')

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 're-test-data-'))
const assetsDefault = path.resolve(repoRoot, '.sofie-assets')
const assetsEnv = process.env.SOFIE_MEGAREPO_ASSETS?.trim() || assetsDefault

const env = {
	...process.env,
	DATA_DIR: dataDir,
	SOFIE_MEGAREPO_ASSETS: assetsEnv
}

const result = spawnSync(
	process.execPath,
	[
		'--import',
		'tsx',
		'--test',
		'--test-concurrency=1',
		path.join(backendRoot, 'src/**/*.test.ts'),
		path.join(repoRoot, 'frontend/src/util/**/*.test.ts')
	],
	{
		cwd: repoRoot,
		env,
		stdio: 'inherit'
	}
)

try {
	fs.rmSync(dataDir, { recursive: true, force: true })
} catch {
	// best-effort cleanup
}

process.exit(result.status ?? 1)
