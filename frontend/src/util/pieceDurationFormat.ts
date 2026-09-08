/** Cut point within the wipe stinger when screen is fully covered (frame 38 @ 50fps). */
export const WIPE_CUT_POINT_SECONDS = 760 / 1000

/** Sub-minute durations without rounding hundredths away (e.g. 0.76s, not 0.8s). */
export function formatSecondsPrecise(seconds: number, maxDecimals = 2): string {
	const text = seconds.toFixed(maxDecimals).replace(/\.?0+$/, '')
	return `${text}s`
}

const pad2 = (t: number) => ('00' + t).substr(-2)

/**
 * Format the seconds component of a clock (`ss` or `ss.frac`), trimming trailing zeros.
 * Examples: 5 → `05`, 2.5 → `02.5`, 0.76 → `00.76`
 * Caller must pass a value already rounded to hundredths and in `[0, 60)`.
 */
function formatClockSecondsPart(secondsInMinute: number): string {
	const fixed = secondsInMinute.toFixed(2).replace(/\.?0+$/, '')
	const [intPart, frac] = fixed.split('.')
	const padded = pad2(Number(intPart))
	return frac !== undefined ? `${padded}.${frac}` : padded
}

/**
 * Format seconds as clock display (`mm:ss`, `mm:ss.frac`, or `h:mm:ss[.frac]`).
 * Fractional on-air values (e.g. wipe 2.5s) render as `00:02.5`.
 * Rounds the total to hundredths first so carry rolls into minutes/hours
 * (e.g. 59.999 → `01:00`, never `00:60`).
 */
export function formatSecondsClock(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return '00:00'
	}

	const total = Math.round(seconds * 100) / 100
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = Math.round((total - h * 3600 - m * 60) * 100) / 100

	return `${h > 0 ? pad2(h) + ':' : ''}${pad2(m)}:${formatClockSecondsPart(s)}`
}

/**
 * Parse On air clock text (`mm:ss`, `mm:ss.frac`, `h:mm:ss[.frac]`, or plain seconds / `12.5s`)
 * into seconds. Empty / whitespace → undefined (clear On air).
 */
export function parseDurationClockInput(raw: string): number | undefined {
	const trimmed = raw.trim()
	if (!trimmed) {
		return undefined
	}

	const secondsSuffix = trimmed.match(/^(\d+(?:\.\d+)?)\s*s$/i)
	if (secondsSuffix) {
		const n = Number(secondsSuffix[1])
		return Number.isFinite(n) && n >= 0 ? n : undefined
	}

	if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
		const n = Number(trimmed)
		return Number.isFinite(n) && n >= 0 ? n : undefined
	}

	const parts = trimmed.split(':')
	if (parts.length < 2 || parts.length > 3) {
		return undefined
	}

	const head = parts.slice(0, -1)
	const secPart = parts[parts.length - 1]
	if (!head.every((p) => /^\d{1,2}$/.test(p))) {
		return undefined
	}
	if (!/^\d{1,2}(?:\.\d+)?$/.test(secPart)) {
		return undefined
	}

	const nums = [...head.map((p) => Number(p)), Number(secPart)]
	if (nums.some((n) => !Number.isFinite(n))) {
		return undefined
	}

	const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]]
	if (m > 59 || s >= 60) {
		return undefined
	}
	return h * 3600 + m * 60 + s
}

/**
 * Files whose basenames differ by only a digit or a single character (same extension).
 * Helps catch near-duplicate on-air picks (SYN1 vs SYN2, FOO vs FOO2).
 */
export function findNearDuplicateMediaNames(selectedPath: string, allPaths: string[]): string[] {
	const selected = basenameStemExt(selectedPath)
	if (!selected) {
		return []
	}

	const matches: string[] = []
	for (const otherPath of allPaths) {
		if (otherPath === selectedPath) {
			continue
		}
		const other = basenameStemExt(otherPath)
		if (!other || other.dir !== selected.dir || other.ext !== selected.ext) {
			continue
		}
		if (stemsNearDuplicate(selected.stem, other.stem)) {
			matches.push(otherPath)
		}
	}
	return matches
}

function basenameStemExt(path: string): { dir: string; stem: string; ext: string } | null {
	const normalized = path.replace(/\\/g, '/').trim()
	if (!normalized) {
		return null
	}
	const parts = normalized.split('/')
	const base = parts.pop() ?? ''
	const dir = parts.join('/').toLowerCase()
	const dot = base.lastIndexOf('.')
	if (dot <= 0) {
		return { dir, stem: base.toLowerCase(), ext: '' }
	}
	return {
		dir,
		stem: base.slice(0, dot).toLowerCase(),
		ext: base.slice(dot).toLowerCase()
	}
}

function stemsNearDuplicate(a: string, b: string): boolean {
	if (a === b) {
		return true
	}
	const longer = a.length >= b.length ? a : b
	const shorter = a.length >= b.length ? b : a
	if (longer.length - shorter.length > 1) {
		return false
	}
	if (longer.length === shorter.length + 1) {
		let shortIndex = 0
		let skipped = false
		for (const character of longer) {
			if (shortIndex < shorter.length && character === shorter[shortIndex]) {
				shortIndex++
			} else if (skipped) {
				return false
			} else {
				skipped = true
			}
		}
		return shortIndex === shorter.length
	}
	let diffs = 0
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			diffs++
			if (diffs > 1) {
				return false
			}
		}
	}
	return diffs === 1
}
