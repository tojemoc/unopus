import { useMemo } from 'react'
import { useAppSelector } from '~/store/app'
import type { Part, PieceReadiness, RundownReadiness } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { findTypeManifest } from '~/util/typeManifest'
import { ReadinessBadge, getPieceReadinessTooltip } from '../readinessBadge'
import { EditorialStatusBadge } from '../editorialStatusBadge'
import { formatPartOnAirDuration } from '~/util/pieceDuration'
import { resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { resolveEditorialStatus } from '~/util/editorialStatus'
import { useRowLocks } from '~/hooks/usePresence'
import { useRundownReadinessContext } from '~/hooks/RundownReadinessContext'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { PartExpandedPanel } from '../partExpandedPanel'

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

function typeTint(hex: string | undefined): string {
	if (!hex) return 'transparent'
	const cleaned = hex.replace('#', '')
	if (cleaned.length !== 6) {
		return `color-mix(in srgb, ${hex} 22%, transparent)`
	}
	const r = parseInt(cleaned.slice(0, 2), 16)
	const g = parseInt(cleaned.slice(2, 4), 16)
	const b = parseInt(cleaned.slice(4, 6), 16)
	return `rgba(${r}, ${g}, ${b}, 0.22)`
}

export function SidebarPartRow({ part }: { part: Part }) {
	const { readiness } = useRundownReadinessContext()
	const { expandedPartId, toggleExpandedPart } = useScriptExpand()
	const expanded = expandedPartId === part.id

	const partTypeManifest = useAppSelector((state) =>
		findTypeManifest(state.typeManifests.manifests, part.partType, TypeManifestEntity.Part)
	)
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const settings = useAppSelector((s) => s.settings.settings)
	const allPieces = useAppSelector((s) => s.pieces.pieces)
	const partPieces = useMemo(
		() => allPieces.filter((piece) => piece.partId === part.id),
		[allPieces, part.id]
	)
	const scriptCps = resolveEffectiveScriptCps({ userScriptCps, settingsCps: settings?.scriptCps })

	const storyReadiness = getStoryReadiness(part.id, partPieces, readiness)
	const locks = useRowLocks('part', part.id)
	const editorial = resolveEditorialStatus({
		skip: part.skip,
		editorChecked: part.editorChecked,
		skipStatusUnlessEditorChecked: settings?.skipStatusUnlessEditorChecked !== false,
		requireEditorCheckForAir: Boolean(settings?.requireEditorCheckForAir)
	})

	const typeColour = partTypeManifest?.colour ?? '#666'

	const rowClass = [
		'story-row',
		'story-row--typed',
		expanded ? 'active story-row--expanded' : '',
		part.skip ? 'story-row--skipped' : '',
		part.float ? 'story-row--floated' : '',
		storyReadiness?.state === 'ready' ? 'story-row--ready' : '',
		storyReadiness?.state === 'not-ready' ? 'story-row--not-ready' : '',
		locks.length ? 'story-row--locked' : ''
	]
		.filter(Boolean)
		.join(' ')

	return (
		<div className="story-row-block">
			<div
				className={rowClass}
				tabIndex={0}
				onClick={() => toggleExpandedPart(part.id)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault()
						toggleExpandedPart(part.id)
					}
				}}
				style={{
					borderLeftColor: typeColour,
					backgroundColor: typeTint(typeColour)
				}}
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
						style={{ backgroundColor: typeColour }}
						title={partTypeManifest?.name ?? part.partType}
					>
						{partTypeManifest?.shortName ?? part.partType.slice(0, 4).toUpperCase()}
					</span>
				</div>
				<div className="col-title" title={part.name}>
					<span className="story-row__title">{part.name}</span>
					{locks.length ? (
						<span
							className="story-row__lock"
							title={locks.map((lock) => `${lock.displayName} is editing this story`).join(', ')}
						>
							🔒 {locks.map((lock) => lock.displayName).join(', ')}
						</span>
					) : null}
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
			{expanded ? <PartExpandedPanel part={part} /> : null}
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
