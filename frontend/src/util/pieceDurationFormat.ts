/** Cut point within the wipe stinger when screen is fully covered (frame 38 @ 50fps). */
export const WIPE_CUT_POINT_SECONDS = 760 / 1000

/** Sub-minute durations without rounding hundredths away (e.g. 0.76s, not 0.8s). */
export function formatSecondsPrecise(seconds: number, maxDecimals = 2): string {
	const text = seconds.toFixed(maxDecimals).replace(/\.?0+$/, '')
	return `${text}s`
}

/**
 * Format seconds as clock display (mm:ss or h:mm:ss, or Xs for fractional seconds).
 */
export function formatSecondsClock(seconds: number): string {
	// Keep fractional wipe default readable (2.5s) without breaking mm:ss for whole seconds.
	if (!Number.isInteger(seconds) && seconds < 60) {
		const rounded = Math.round(seconds * 10) / 10
		return `${rounded}s`
	}

	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = Math.floor(seconds % 60)
	const pad = (t: number) => ('00' + t).substr(-2)

	return `${h > 0 ? pad(h) + ':' : ''}${pad(m)}:${pad(s)}`
}

/**
 * Parse On air clock text (`mm:ss`, `h:mm:ss`, or plain seconds / `12.5s`) into seconds.
 * Empty / whitespace → undefined (clear On air).
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
	if (!parts.every((p) => /^\d{1,2}$/.test(p))) {
		return undefined
	}

	const nums = parts.map((p) => Number(p))
	if (nums.some((n) => !Number.isFinite(n))) {
		return undefined
	}

	const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]]
	if (m > 59 || s > 59) {
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
		if (!other || other.ext !== selected.ext) {
			continue
		}
		if (stemsNearDuplicate(selected.stem, other.stem)) {
			matches.push(otherPath)
		}
	}
	return matches
}

function basenameStemExt(path: string): { stem: string; ext: string } | null {
	const normalized = path.replace(/\\/g, '/').trim()
	if (!normalized) {
		return null
	}
	const base = normalized.split('/').pop() ?? ''
	const dot = base.lastIndexOf('.')
	if (dot <= 0) {
		return { stem: base.toLowerCase(), ext: '' }
	}
	return {
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
		return longer.startsWith(shorter) || longer.endsWith(shorter)
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
