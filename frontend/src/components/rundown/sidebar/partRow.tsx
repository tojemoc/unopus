import { useMemo, useRef, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { BsLockFill } from 'react-icons/bs'
import { useAppDispatch, useAppSelector } from '~/store/app'
import type { Part, PieceReadiness, RundownReadiness } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { findTypeManifest } from '~/util/typeManifest'
import { ReadinessBadge, getPieceReadinessTooltip } from '../readinessBadge'
import { EditorialStatusBadge } from '../editorialStatusBadge'
import { formatPartOnAirDuration } from '~/util/pieceDuration'
import { partUsesScriptDuration, resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { resolveEffectiveIluDurationMode } from '~backend/background/storyDuration'
import { firstScriptLine } from '~/util/scriptPreview'
import { resolveShowPartScriptExcerpt } from '~/util/scriptExcerptPreference'
import { resolveEditorialStatus } from '~/util/editorialStatus'
import { requestPresenceFocus, useRowLocks } from '~/hooks/usePresence'
import { useRundownReadinessContext } from '~/hooks/RundownReadinessContext'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { PartExpandedPanel } from '../partExpandedPanel'
import { useToasts } from '~/components/toasts/useToasts'
import { updatePart } from '~/store/parts'
import { canEditRundown } from '~/util/roles'

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
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const { readiness } = useRundownReadinessContext()
	const { expandedPartId, setExpandedPartId } = useScriptExpand()
	const livePart = useAppSelector((s) => s.parts.parts.find((p) => p.id === part.id) ?? part)
	const expanded = expandedPartId === livePart.id
	const [takeoverHolder, setTakeoverHolder] = useState<string | null>(null)
	/** True when the modal is for a System (playout) lock — never key off displayName alone. */
	const [takeoverIsSystem, setTakeoverIsSystem] = useState(false)
	const [busy, setBusy] = useState(false)
	const [autoBusy, setAutoBusy] = useState(false)
	const pointerStart = useRef<{ x: number; y: number } | null>(null)

	const partTypeManifest = useAppSelector((state) =>
		findTypeManifest(state.typeManifests.manifests, livePart.partType, TypeManifestEntity.Part)
	)
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const userShowScriptExcerpt = useAppSelector((s) => s.auth.user?.showPartScriptExcerpt)
	const userRole = useAppSelector((s) => s.auth.user?.role)
	const settings = useAppSelector((s) => s.settings.settings)
	const allPieces = useAppSelector((s) => s.pieces.pieces)
	const partPieces = useMemo(
		() => allPieces.filter((piece) => piece.partId === livePart.id),
		[allPieces, livePart.id]
	)
	const scriptCps = resolveEffectiveScriptCps({ userScriptCps, settingsCps: settings?.scriptCps })
	const siteDurationMode = settings?.iluDurationMode ?? 'auto'
	const durationOpts = useMemo(
		() => ({
			scriptCps,
			defaultDurationMode: siteDurationMode
		}),
		[scriptCps, siteDurationMode]
	)

	const storyReadiness = getStoryReadiness(livePart.id, partPieces, readiness)
	const locks = useRowLocks('part', livePart.id)
	const playoutState = useAppSelector((state) => state.playout.byRundownId[livePart.rundownId])
	const isOnAir = playoutState?.currentPartId === livePart.id
	const systemLocks = locks.filter((lock) => lock.userId === 'system')
	const lockedBySystem = systemLocks.length > 0
	const editorial = resolveEditorialStatus({
		skip: livePart.skip,
		editorChecked: livePart.editorChecked,
		skipStatusUnlessEditorChecked: settings?.skipStatusUnlessEditorChecked !== false,
		requireEditorCheckForAir: Boolean(settings?.requireEditorCheckForAir)
	})

	const showScriptExcerpt = resolveShowPartScriptExcerpt(
		userShowScriptExcerpt,
		settings?.showPartScriptExcerpt
	)
	const scriptPreview = showScriptExcerpt ? firstScriptLine(livePart.script) : null
	const typeColour = partTypeManifest?.colour ?? '#666'
	const lockNames = locks.map((lock) => lock.displayName).join(', ')
	const scriptDriven = partUsesScriptDuration(
		livePart.partType,
		partPieces.filter((piece) => !piece.skip).map((piece) => piece.pieceType)
	)
	const effectiveDurationMode = resolveEffectiveIluDurationMode(
		livePart.durationMode,
		siteDurationMode
	)
	const autoOn = effectiveDurationMode === 'auto'
	const displayedDuration =
		formatPartOnAirDuration(
			livePart,
			partPieces.map((piece) => ({
				pieceType: piece.pieceType,
				duration: piece.duration,
				skip: piece.skip
			})),
			durationOpts
		) || '--:--'

	const toggleAuto = async (event: React.MouseEvent) => {
		event.preventDefault()
		event.stopPropagation()
		// Same foreign-lock gate as handleActivate: do not overwrite another editor's
		// durationMode (or race their later save) without takeover confirmation.
		if (autoBusy || locks.length > 0 || !scriptDriven || !canEditRundown(userRole)) {
			return
		}
		setAutoBusy(true)
		try {
			await dispatch(
				updatePart({
					part: {
						...livePart,
						// Explicit override: AUTO on = script/CPS + autoNext; off = until next take.
						durationMode: autoOn ? 'manual' : 'auto'
					}
				})
			).unwrap()
		} catch (error) {
			console.error(error)
			toasts.show({
				headerContent: 'AUTO mode',
				bodyContent: 'Could not update take-after-duration for this story.'
			})
		} finally {
			setAutoBusy(false)
		}
	}

	const rowClass = [
		'story-row',
		'story-row--typed',
		expanded ? 'active story-row--expanded' : '',
		livePart.skip ? 'story-row--skipped' : '',
		livePart.float ? 'story-row--floated' : '',
		storyReadiness?.state === 'ready' ? 'story-row--ready' : '',
		storyReadiness?.state === 'not-ready' ? 'story-row--not-ready' : '',
		locks.length ? 'story-row--locked' : '',
		isOnAir ? 'story-row--on-air' : ''
	]
		.filter(Boolean)
		.join(' ')

	const canEdit = canEditRundown(userRole)

	const openStory = async (force: boolean) => {
		// Viewers expand read-only without acquiring (or force-taking) an edit lock.
		if (!canEdit) {
			setTakeoverHolder(null)
			setTakeoverIsSystem(false)
			setExpandedPartId(livePart.id)
			return
		}
		setBusy(true)
		try {
			const result = await requestPresenceFocus({
				entityType: 'part',
				entityId: livePart.id,
				rundownId: livePart.rundownId,
				force
			})
			if (result.ok) {
				setTakeoverHolder(null)
				setTakeoverIsSystem(false)
				setExpandedPartId(livePart.id)
				return
			}
			if (result.reason === 'unavailable') {
				// Don't block editing if presence is down; still open locally.
				console.warn('Story lock unavailable; opening without exclusive lock')
				setTakeoverHolder(null)
				setTakeoverIsSystem(false)
				setExpandedPartId(livePart.id)
				return
			}
			setTakeoverHolder(result.holder.displayName || lockNames || 'Another user')
			setTakeoverIsSystem(result.holder.userId === 'system')
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
		// On-air / lookahead stories stay readable so the prompter script is not hidden.
		if (lockedBySystem) {
			setExpandedPartId(livePart.id)
			return
		}
		// Viewers: expand without lock / takeover UI.
		if (!canEdit) {
			setExpandedPartId(livePart.id)
			return
		}
		// Fast path: known foreign lock from presence snapshot → confirm before kicking.
		if (locks.length > 0) {
			setTakeoverHolder(lockNames || locks[0]?.displayName || 'Another user')
			setTakeoverIsSystem(false)
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
						title={partTypeManifest?.name ?? livePart.partType}
					>
						{partTypeManifest?.shortName ?? livePart.partType.slice(0, 4).toUpperCase()}
					</span>
				</div>
				<div
					className="col-title"
					title={
						livePart.script?.trim() ? `${livePart.name}\n${livePart.script}` : livePart.name
					}
				>
					<span className="story-row__title">{livePart.name}</span>
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
					{scriptPreview ? <div className="story-row__script">{scriptPreview}</div> : null}
				</div>
				<div className="col-duration">
					<span
						className="story-row__time"
						title={
							scriptDriven
								? autoOn
									? 'On air (AUTO)'
									: 'On air (until next take)'
								: 'On air'
						}
					>
						{displayedDuration}
					</span>
					{scriptDriven ? (
						<button
							type="button"
							className={`story-row__auto${autoOn ? ' story-row__auto--on' : ''}`}
							aria-pressed={autoOn}
							disabled={autoBusy || locks.length > 0 || !canEditRundown(userRole)}
							title={
								!canEditRundown(userRole)
									? 'AUTO unavailable in read-only mode'
									: locks.length > 0
										? lockedBySystem
											? 'AUTO unavailable while System holds this story'
											: `AUTO unavailable while ${lockNames || 'another user'} is editing`
										: autoOn
											? 'AUTO on — script/CPS drives On air; Sofie may auto-take. Click for until next take.'
											: 'AUTO off — until next take (no autoNext). Click to enable AUTO.'
							}
							onClick={(event) => {
								void toggleAuto(event)
							}}
							onPointerDown={(event) => event.stopPropagation()}
							onKeyDown={(event) => event.stopPropagation()}
						>
							AUTO
						</button>
					) : null}
				</div>
			</div>
			{expanded ? (
				<PartExpandedPanel part={livePart} readOnly={lockedBySystem || !canEditRundown(userRole)} />
			) : null}


			<Modal
				show={takeoverHolder !== null}
				onHide={() => {
					setTakeoverHolder(null)
					setTakeoverIsSystem(false)
				}}
				onClick={(e: React.MouseEvent) => e.stopPropagation()}
			>
				<Modal.Header closeButton>
					<Modal.Title>Story is locked</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					{takeoverIsSystem ? (
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
					<Button
						variant="secondary"
						disabled={busy}
						onClick={() => {
							setTakeoverHolder(null)
							setTakeoverIsSystem(false)
						}}
					>
						{takeoverIsSystem ? 'OK' : 'Cancel'}
					</Button>
					{takeoverIsSystem ? null : (
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
			<div className="col-duration">Dur / AUTO</div>
		</div>
	)
}
