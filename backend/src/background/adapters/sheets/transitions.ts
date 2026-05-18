import { TRANSITION } from './types'
import type { SheetRow } from './types'

/** Strip diacritics, uppercase, trim (matches legacy AppScript normalize). */
export function normalizeText(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.trim()
}

function getPlayoutType(playout: string): string | null {
	const p = playout.trim().toUpperCase()
	if (p.startsWith('SYN CLUSTER')) return 'SYN CLUSTER'
	if (p.startsWith('SYN RUCH')) return 'SYN RUCH'
	if (p.startsWith('ILU')) return 'ILU'
	if (p.startsWith('SYN')) return 'SYN'
	return null
}

function prevTypeLabel(type: string): string {
	if (type === 'SYN CLUSTER' || type === 'SYN RUCH') return 'SYN'
	return type
}

/**
 * Context-aware transition pass (column I). Overwrites per-row defaults where rules apply.
 */
export function recalculateTransitions(rows: SheetRow[]): SheetRow[] {
	const result = rows.map((row) => ({ ...row }))
	const specialHandled = new Set<number>()
	const spravySeen = new Set<string>()
	const sportSeen = new Set<string>()

	for (let i = 0; i < result.length; i++) {
		const blockNorm = normalizeText(result[i].block)

		if (blockNorm === 'SPRAVY JEDNOU VETOU') {
			const key = blockNorm
			if (!spravySeen.has(key)) {
				result[i].transition = TRANSITION.SPRAVY_JV
				spravySeen.add(key)
			} else {
				result[i].transition = TRANSITION.SPRAVY_JV_NEXT
			}
			specialHandled.add(i)
			continue
		}

		if (blockNorm === 'SPORT') {
			const key = blockNorm
			if (!sportSeen.has(key)) {
				result[i].transition = TRANSITION.SPORT
				sportSeen.add(key)
			} else {
				result[i].transition = TRANSITION.SPORT_NEXT
			}
			specialHandled.add(i)
			continue
		}

		if (blockNorm === 'POCASIE') {
			result[i].transition = TRANSITION.POCASIE
			specialHandled.add(i)
			if (i + 1 < result.length) {
				result[i + 1].transition = TRANSITION.ZAVER
				specialHandled.add(i + 1)
			}
			if (i + 2 < result.length) {
				result[i + 2].transition = TRANSITION.OUTRO
				specialHandled.add(i + 2)
			}
		}
	}

	for (let i = 1; i < result.length; i++) {
		if (specialHandled.has(i)) continue

		const currType = getPlayoutType(result[i].playout)
		const prevType = getPlayoutType(result[i - 1].playout)
		if (!currType || !prevType) continue

		const prevLabel = prevTypeLabel(prevType)
		let transition = `${prevLabel} TO ${currType}`

		const temaChanged =
			normalizeText(result[i].block) !== normalizeText(result[i - 1].block)
		if (
			temaChanged &&
			currType !== 'SYN RUCH' &&
			!(prevLabel === 'SYN' && currType === 'SYN CLUSTER')
		) {
			transition += ' TEMA'
		}

		result[i].transition = transition
	}

	return result
}
