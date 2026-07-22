import { useNavigate, useMatchRoute } from '@tanstack/react-router'
import { useAppSelector } from '~/store/app'
import type { Part, PieceReadiness, RundownReadiness } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { findTypeManifest } from '~/util/typeManifest'
import { displayTime } from './displayTime'
import { ReadinessBadge, getPieceReadinessTooltip } from '../readinessBadge'

function getStoryReadiness(
	partId: string,
	pieces: { id: string; partId: string }[],
	readiness: RundownReadiness | null
): { state: 'ready' | 'not-ready' | 'na'; tooltip?: string } | null {
	if (!readiness) {
		return null
	}

	const partPieces = pieces.filter((piece) => piece.partId === partId)
	const mediaPieces = partPieces.filter((piece) => readiness.pieces[piece.id]?.requirements.length)

	if (!mediaPieces.length) {
		return { state: 'na', tooltip: 'No media items in this story' }
	}

	const partStatus = readiness.parts[partId]
	const ready = partStatus?.ready ?? false

	if (ready) {
		return {
			state: 'ready',
			tooltip: `${partStatus?.readyMediaPieceCount ?? 0}/${partStatus?.mediaPieceCount ?? 0} media items ready`
		}
	}

	const issues = mediaPieces
		.flatMap((piece) => readiness.pieces[piece.id]?.requirements ?? [])
		.filter((req) => !req.ready)
		.map((req) => req.reason ?? 'Not ready')

	return {
		state: 'not-ready',
		tooltip: issues.join('; ') || 'Media missing'
	}
}

export function SidebarPartRow({
	part,
	readiness,
	partPieces
}: {
	part: Part
	readiness: RundownReadiness | null
	partPieces: { id: string; partId: string }[]
}) {
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()

	const partTypeManifest = useAppSelector((state) =>
		findTypeManifest(state.typeManifests.manifests, part.partType, TypeManifestEntity.Part)
	)

	const isActive = Boolean(
		matchRoute({
			to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
			params: {
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				partId: part.id
			}
		})
	)

	const storyReadiness = getStoryReadiness(part.id, partPieces, readiness)

	const openPart = () => {
		void navigate({
			to: '/rundown/$rundownId/segment/$segmentId/part/$partId',
			params: {
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				partId: part.id
			}
		})
	}

	return (
		<div
			className={`story-row ${isActive ? 'active' : ''}`}
			tabIndex={0}
			onClick={openPart}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault()
					openPart()
				}
			}}
			style={{ borderLeftColor: partTypeManifest?.colour ?? '#666' }}
		>
			<div className="col-status">
				{storyReadiness ? (
					<ReadinessBadge state={storyReadiness.state} tooltip={storyReadiness.tooltip} compact />
				) : null}
			</div>
			<div className="col-type">
				<span
					className="story-type-chip"
					style={{ backgroundColor: partTypeManifest?.colour ?? '#666' }}
					title={partTypeManifest?.name ?? part.partType}
				>
					{partTypeManifest?.shortName ?? part.partType.slice(0, 4).toUpperCase()}
				</span>
			</div>
			<div className="col-title" title={part.name}>
				{part.name}
			</div>
			<div className="col-duration">
				{part.duration ? displayTime(part.duration) : '--:--'}
			</div>
		</div>
	)
}

export function getPieceReadinessState(
	pieceId: string,
	readiness: RundownReadiness | null
): { state: 'ready' | 'not-ready' | 'na'; tooltip?: string } | null {
	if (!readiness) {
		return null
	}

	const pieceReadiness: PieceReadiness | undefined = readiness.pieces[pieceId]

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
		<div className="story-table-header">
			<div className="col-status">Status</div>
			<div className="col-type">Type</div>
			<div className="col-title">Story</div>
			<div className="col-duration">Dur</div>
		</div>
	)
}
