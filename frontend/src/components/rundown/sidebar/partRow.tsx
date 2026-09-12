import { useMemo, useRef, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { BsLockFill } from 'react-icons/bs'
import { useAppSelector } from '~/store/app'
import type { Part, PieceReadiness, RundownReadiness } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { findTypeManifest } from '~/util/typeManifest'
import { ReadinessBadge, getPieceReadinessTooltip } from '../readinessBadge'
import { EditorialStatusBadge } from '../editorialStatusBadge'
import { formatPartOnAirDuration } from '~/util/pieceDuration'
import { resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { resolveEditorialStatus } from '~/util/editorialStatus'
import { requestPresenceFocus, useRowLocks } from '~/hooks/usePresence'
import { useRundownReadinessContext } from '~/hooks/RundownReadinessContext'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { PartExpandedPanel } from '../partExpandedPanel'
import { useToasts } from '~/components/toasts/useToasts'

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
	const toasts = useToasts()
	const { readiness } = useRundownReadinessContext()
	const { expandedPartId, setExpandedPartId } = useScriptExpand()
	const expanded = expandedPartId === part.id
	const [takeoverHolder, setTakeoverHolder] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const pointerStart = useRef<{ x: number; y: number } | null>(null)

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
	const durationOpts = useMemo(
		() => ({
			scriptCps,
			defaultDurationMode: settings?.iluDurationMode ?? 'auto'
		}),
		[scriptCps, settings?.iluDurationMode]
	)

	const storyReadiness = getStoryReadiness(part.id, partPieces, readiness)
	const locks = useRowLocks('part', part.id)
	const playoutState = useAppSelector((state) => state.playout.byRundownId[part.rundownId])
	const isOnAir = playoutState?.currentPartId === part.id
	const systemLocks = locks.filter((lock) => lock.userId === 'system')
	const lockedBySystem = systemLocks.length > 0
	const editorial = resolveEditorialStatus({
		skip: part.skip,
		editorChecked: part.editorChecked,
		skipStatusUnlessEditorChecked: settings?.skipStatusUnlessEditorChecked !== false,
		requireEditorCheckForAir: Boolean(settings?.requireEditorCheckForAir)
	})

	const typeColour = partTypeManifest?.colour ?? '#666'
	const lockNames = locks.map((lock) => lock.displayName).join(', ')

	const rowClass = [
		'story-row',
		'story-row--typed',
		expanded ? 'active story-row--expanded' : '',
		part.skip ? 'story-row--skipped' : '',
		part.float ? 'story-row--floated' : '',
		storyReadiness?.state === 'ready' ? 'story-row--ready' : '',
		storyReadiness?.state === 'not-ready' ? 'story-row--not-ready' : '',
		locks.length ? 'story-row--locked' : '',
		isOnAir ? 'story-row--on-air' : ''
	]
		.filter(Boolean)
		.join(' ')

	const openStory = async (force: boolean) => {
		setBusy(true)
		try {
			const result = await requestPresenceFocus({
				entityType: 'part',
				entityId: part.id,
				rundownId: part.rundownId,
				force
			})
			if (result.ok) {
				setTakeoverHolder(null)
				setExpandedPartId(part.id)
				return
			}
			if (result.reason === 'unavailable') {
				// Don't block editing if presence is down; still open locally.
				console.warn('Story lock unavailable; opening without exclusive lock')
				setTakeoverHolder(null)
				setExpandedPartId(part.id)
				return
			}
			setTakeoverHolder(result.holder.displayName || lockNames || 'Another user')
		} catch (error) {
			console.error(error)
			toasts.show({
				headerContent: 'Story lock',
				bodyContent: 'Could not open this story. Check your connection and try again.'
			})
		} finally {
			setBusy(false)
		}
	}

	const handleActivate = () => {
		if (busy) {
			return
		}
		if (expanded) {
			setExpandedPartId(null)
			return
		}
		// Fast path: known foreign lock from presence snapshot → confirm before kicking.
		if (locks.length > 0) {
			if (lockedBySystem) {
				setTakeoverHolder('System')
				return
			}
			setTakeoverHolder(lockNames || locks[0]?.displayName || 'Another user')
			return
		}
		void openStory(false)
	}

	return (
		<div className="story-row-block">
			<div
				className={rowClass}
				tabIndex={0}
				role="button"
				aria-expanded={expanded}
				aria-busy={busy || undefined}
				onPointerDown={(event) => {
					pointerStart.current = { x: event.clientX, y: event.clientY }
				}}
				onClick={(event) => {
					// Ignore click that followed a drag gesture (react-dnd).
					const start = pointerStart.current
					pointerStart.current = null
					if (
						start &&
						(Math.abs(event.clientX - start.x) > 4 || Math.abs(event.clientY - start.y) > 4)
					) {
						return
					}
					handleActivate()
				}}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault()
						handleActivate()
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
					{isOnAir ? (
						<span className="story-row__on-air" title="On air in Sofie">
							ON AIR
						</span>
					) : null}
					{locks.length ? (
						<span
							className="story-row__lock"
							title={`${lockNames} is editing this story`}
						>
							<BsLockFill aria-hidden /> {lockNames}
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
						durationOpts
					) || '--:--'}
				</div>
			</div>
			{expanded ? <PartExpandedPanel part={part} /> : null}

			<Modal
				show={takeoverHolder !== null}
				onHide={() => setTakeoverHolder(null)}
				onClick={(e: React.MouseEvent) => e.stopPropagation()}
			>
				<Modal.Header closeButton>
					<Modal.Title>Story is locked</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					{takeoverHolder === 'System' || lockedBySystem ? (
						<>
							This story is locked by <strong>System</strong> because it is Sofie&apos;s previous,
							current, or next part. It cannot be edited until playout moves on.
						</>
					) : (
						<>
							{takeoverHolder ?? 'Another user'} is currently editing this story. Opening it will kick
							them out and any unsaved changes they have may be lost.
						</>
					)}
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" disabled={busy} onClick={() => setTakeoverHolder(null)}>
						{takeoverHolder === 'System' || lockedBySystem ? 'OK' : 'Cancel'}
					</Button>
					{takeoverHolder === 'System' || lockedBySystem ? null : (
						<Button
							variant="danger"
							disabled={busy}
							onClick={() => {
								void openStory(true)
							}}
						>
							Kick out and open
						</Button>
					)}
				</Modal.Footer>
			</Modal>
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
