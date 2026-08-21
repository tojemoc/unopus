import { useNavigate, useMatchRoute } from '@tanstack/react-router'
import { useAppSelector } from '~/store/app'
import type { Part, PieceReadiness, RundownReadiness } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { findTypeManifest } from '~/util/typeManifest'
import { ReadinessBadge, getPieceReadinessTooltip } from '../readinessBadge'
import { EditorialStatusBadge } from '../editorialStatusBadge'
import { resolveEditorialStatus } from '~/util/editorialStatus'
import { formatPartOnAirDuration } from '~/util/pieceDuration'
import { resolveEffectiveScriptCps } from '~/util/scriptReadingTime'

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
	partPieces: Array<{
		id: string
		partId: string
		pieceType: string
		duration?: number
		skip?: boolean
	}>
}) {
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()

	const partTypeManifest = useAppSelector((state) =>
		findTypeManifest(state.typeManifests.manifests, part.partType, TypeManifestEntity.Part)
	)
	const userId = useAppSelector((s) => s.auth.user?.id)
	const settings = useAppSelector((s) => s.settings.settings)
	const scriptCps = resolveEffectiveScriptCps({ userId, settingsCps: settings?.scriptCps })

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
	const editorial = resolveEditorialStatus({
		skip: part.skip,
		editorChecked: part.editorChecked,
		skipStatusUnlessEditorChecked: settings?.skipStatusUnlessEditorChecked !== false,
		requireEditorCheckForAir: Boolean(settings?.requireEditorCheckForAir)
	})

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

	const rowClass = [
		'story-row',
		isActive ? 'active' : '',
		part.skip ? 'story-row--skipped' : '',
		part.float ? 'story-row--floated' : ''
	]
		.filter(Boolean)
		.join(' ')

	return (
		<div
			className={rowClass}
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
				<span className="d-inline-flex gap-1 align-items-center">
					{storyReadiness ? (
						<ReadinessBadge state={storyReadiness.state} tooltip={storyReadiness.tooltip} compact />
					) : null}
					{editorial ? (
						<EditorialStatusBadge
							status={editorial.status}
							tooltip={editorial.tooltip}
							compact
						/>
					) : null}
				</span>
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
				{formatPartOnAirDuration(
					part,
					partPieces.map((piece) => ({
						pieceType: piece.pieceType,
						duration: piece.duration,
						skip: piece.skip
					})),
					{ scriptCps }
				) || '--:--'}
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
		tooltip: getPieceReadinessTooltip(pieceReadiness.requirements, {
			pieceSource: pieceReadiness.source,
			coreCallSource: readiness.diagnostics?.coreCallSource,
			coreCallError: readiness.diagnostics?.coreCallError
		})
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
