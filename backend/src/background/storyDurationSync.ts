import { mutations as partsMutations } from './api/parts.js'
import { mutations as piecesMutations } from './api/pieces.js'
import { planStoryDurationSync, type StoryDurationPiece } from './storyDuration.js'

/** Persist inherited story/piece durations after a part or piece edit. */
export async function syncStoryDurationsForPart(partId: string): Promise<void> {
	const { result: part, error: partError } = await partsMutations.readOne(partId)
	if (partError || !part) {
		return
	}

	const { result: piecesResult } = await piecesMutations.read({ partId })
	const pieces = (Array.isArray(piecesResult) ? piecesResult : piecesResult ? [piecesResult] : []).map(
		(piece): StoryDurationPiece => ({
			id: piece.id,
			pieceType: piece.pieceType,
			duration: piece.duration
		})
	)

	const plan = planStoryDurationSync(part, pieces)

	for (const pieceUpdate of plan.pieceUpdates) {
		const { result: piece } = await piecesMutations.readOne(pieceUpdate.id)
		if (!piece || piece.duration === pieceUpdate.duration) {
			continue
		}
		await piecesMutations.update({
			...piece,
			duration: pieceUpdate.duration
		})
	}

	if (plan.partDuration !== undefined && part.duration !== plan.partDuration) {
		await partsMutations.update({
			...part,
			duration: plan.partDuration
		})
	}
}
