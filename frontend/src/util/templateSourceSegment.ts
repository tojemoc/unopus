import type { Part, Segment } from '~backend/background/interfaces'

/** Mirrors backend pickTemplateSourceSegmentId: segment with the most parts. */
export function pickTemplateSourceSegmentId(
	templateRundownId: string,
	segments: Segment[],
	parts: Part[]
): string | undefined {
	const rundownSegments = segments
		.filter((s) => s.rundownId === templateRundownId)
		.sort((a, b) => a.rank - b.rank)
	if (rundownSegments.length === 0) {
		return undefined
	}

	let best = rundownSegments[0]
	let bestCount = 0
	for (const segment of rundownSegments) {
		const count = parts.filter((p) => p.segmentId === segment.id).length
		if (count > bestCount) {
			best = segment
			bestCount = count
		}
	}
	return best.id
}
