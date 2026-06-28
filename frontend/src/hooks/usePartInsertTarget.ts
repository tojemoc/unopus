import { useRouterState } from '@tanstack/react-router'
import { useAppSelector } from '~/store/app'
import { computeInsertRank } from '~/util/lib'
import type { Segment } from '~backend/background/interfaces'

export type PartInsertTarget = {
	segment: Segment
	rank: number
	/** Short hint for toolbar tooltips, e.g. `after "Long story"` */
	hint: string
}

/**
 * Resolves where a quick-add part button should insert, based on the active
 * segment/part route. Falls back to appending within the open segment.
 */
export function usePartInsertTarget(rundownId: string): PartInsertTarget | null {
	const matches = useRouterState({ select: (s) => s.matches })

	const segmentMatch = matches.find((match) => match.fullPath.includes('/segment/$segmentId'))
	const segmentId = (segmentMatch?.params as Record<string, string | undefined>)?.segmentId

	const partMatch = matches.find((match) => match.fullPath.includes('/part/$partId'))
	const partId = (partMatch?.params as Record<string, string | undefined>)?.partId

	const segment = useAppSelector((state) =>
		segmentId
			? (state.segments.segments.find((s) => s.id === segmentId && s.rundownId === rundownId) ??
				null)
			: null
	)

	const segmentParts = useAppSelector((state) =>
		segmentId
			? [...state.parts.parts.filter((p) => p.segmentId === segmentId)].sort(
					(a, b) => a.rank - b.rank
				)
			: []
	)

	if (!segment) {
		return null
	}

	if (partId) {
		const part = segmentParts.find((p) => p.id === partId)
		if (!part) {
			return null
		}

		return {
			segment,
			rank: computeInsertRank(segmentParts, partId),
			hint: `after "${part.name}"`
		}
	}

	if (segmentParts.length === 0) {
		return {
			segment,
			rank: 0,
			hint: `in "${segment.name}"`
		}
	}

	const lastPart = segmentParts[segmentParts.length - 1]
	return {
		segment,
		rank: computeInsertRank(segmentParts, lastPart.id),
		hint: `at end of "${segment.name}"`
	}
}
