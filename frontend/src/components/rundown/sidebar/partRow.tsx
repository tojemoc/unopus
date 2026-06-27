import { useNavigate, useMatchRoute } from '@tanstack/react-router'
import { useAppSelector } from '~/store/app'
import type { Part, PieceReadiness, RundownReadiness, Segment } from '~backend/background/interfaces'
import { PartTypeButtons } from './partTypeButtons'
import { findTypeManifest } from '~/util/typeManifest'
import { displayTime } from './displayTime'
import { ReadinessBadge, getPieceReadinessTooltip } from '../readinessBadge'

function getStoryReadiness(
	partId: string,
	pieces: { id: string; partId: string }[],
	readiness: RundownReadiness | null
): { state: 'ready' | 'not-ready' | 'na'; tooltip?: string } {
	const partPieces = pieces.filter((piece) => piece.partId === partId)
	const mediaPieces = partPieces.filter((piece) => readiness?.pieces[piece.id]?.requirements.length)

	if (!mediaPieces.length) {
		return { state: 'na', tooltip: 'No media items in this story' }
	}

	const partStatus = readiness?.parts[partId]
	const ready = partStatus?.ready ?? false

	if (ready) {
		return {
			state: 'ready',
			tooltip: `${partStatus?.readyMediaPieceCount ?? 0}/${partStatus?.mediaPieceCount ?? 0} media items ready`
		}
	}

	const issues = mediaPieces
		.flatMap((piece) => readiness?.pieces[piece.id]?.requirements ?? [])
		.filter((req) => !req.ready)
		.map((req) => req.reason ?? 'Not ready')

	return {
		state: 'not-ready',
		tooltip: issues.join('; ') || 'Media missing'
	}
}

export function SidebarPartRow({
	part,
	segment,
	insertRank,
	readiness,
	partPieces
}: {
	part: Part
	segment: Segment
	insertRank: number
	readiness: RundownReadiness | null
	partPieces: { id: string; partId: string }[]
}) {
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()

	const partTypeManifest = useAppSelector((state) =>
		findTypeManifest(state.typeManifests.manifests, part.partType)
	)

	const isActive = Boolean(
		matchRoute({
			to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
			params: {
				rundownId: segment.rundownId,
				segmentId: segment.id,
				partId: part.id
			}
		})
	)

	const storyReadiness = getStoryReadiness(part.id, partPieces, readiness)

	const openPart = () => {
		void navigate({
			to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
			params: {
				rundownId: segment.rundownId,
				segmentId: segment.id,
				partId: part.id
			}
		})
	}

	return (
		<div className="sidebar-part-wrapper">
			<div
				className={`story-row ${isActive ? 'active' : ''}`}
				role="row"
				onClick={openPart}
				style={{ borderLeftColor: partTypeManifest?.colour ?? '#666' }}
			>
				<div className="col-status" role="cell">
					<ReadinessBadge state={storyReadiness.state} tooltip={storyReadiness.tooltip} compact />
				</div>
				<div className="col-type" role="cell">
					<span
						className="story-type-chip"
						style={{ backgroundColor: partTypeManifest?.colour ?? '#666' }}
						title={partTypeManifest?.name ?? part.partType}
					>
						{partTypeManifest?.shortName ?? part.partType.slice(0, 4).toUpperCase()}
					</span>
				</div>
				<div className="col-title" role="cell" title={part.name}>
					{part.name}
				</div>
				<div className="col-duration" role="cell">
					{part.duration ? displayTime(part.duration) : '--:--'}
				</div>
			</div>
			<div className="part-button add-button-container">
				<PartTypeButtons segment={segment} rank={insertRank} />
			</div>
		</div>
	)
}

export function getPieceReadinessState(
	pieceId: string,
	readiness: RundownReadiness | null
): { state: 'ready' | 'not-ready' | 'na'; tooltip?: string } {
	const pieceReadiness: PieceReadiness | undefined = readiness?.pieces[pieceId]

	if (!pieceReadiness?.requirements.length) {
		return { state: 'na', tooltip: 'No media required' }
	}

	return {
		state: pieceReadiness.ready ? 'ready' : 'not-ready',
		tooltip: getPieceReadinessTooltip(pieceReadiness.requirements)
	}
}

export function StoryTableHeader() {
	return (
		<div className="story-table-header" role="row">
			<div className="col-status" role="columnheader">
				Status
			</div>
			<div className="col-type" role="columnheader">
				Type
			</div>
			<div className="col-title" role="columnheader">
				Story
			</div>
			<div className="col-duration" role="columnheader">
				Dur
			</div>
		</div>
	)
}
