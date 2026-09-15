import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dropdown, Form, Stack } from 'react-bootstrap'
import type { Part, Piece } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { updatePart } from '~/store/parts'
import { addNewPiece, updatePiece } from '~/store/pieces'
import { useToasts } from '../toasts/useToasts'
import { ScriptReadingCounter } from './scriptReadingCounter'
import { ScriptPieceFlow } from './scriptPieceFlow'
import { PiecePropertiesForm } from './piecePropertiesForm'
import { ClockDurationInput } from './clockDurationInput'
import { DeletePartButton } from './deletePartButton'
import { findTypeManifest, toolbarGroupedManifests, toolbarManifests } from '~/util/typeManifest'
import { resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { usePresenceFocus } from '~/hooks/usePresence'
import { useRundownReadinessContext } from '~/hooks/RundownReadinessContext'
import { useScriptExpand } from '~/hooks/ScriptExpandContext'
import { syncWeatherFromImeteo } from '~/lib/weatherApi'
import { canSeeTechPieces } from '~/util/roles'

const L3D_VARIANT_LABELS: Record<string, string> = {
	'l3d-headline': 'Headline',
	'l3d-mod': 'Moderator',
	'l3d-syn': 'Synchron',
	'l3d-tema': 'Tema',
	'l3d-sjv': 'SJV',
	'l3d-sport': 'SPORT',
	'l3d-odporucanie': 'Odporúčanie'
}

export function PartExpandedPanel({ part, readOnly = false }: { part: Part; readOnly?: boolean }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const { readiness } = useRundownReadinessContext()
	const { setExpandedPartId } = useScriptExpand()

	usePresenceFocus(part.rundownId, 'part', part.id)

	const livePart = useAppSelector((s) => s.parts.parts.find((p) => p.id === part.id) ?? part)
	// Select the store array by reference; filter/sort in useMemo so useAppSelector
	// does not see a new array every call (that forces an infinite re-render loop).
	const allPieces = useAppSelector((s) => s.pieces.pieces)
	const pieces = useMemo(
		() =>
			allPieces
				.filter((p) => p.partId === part.id)
				.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)),
		[allPieces, part.id]
	)
	const manifests = useAppSelector((s) => s.typeManifests.manifests)
	const userRole = useAppSelector((s) => s.auth.user?.role)
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const settingsCps = useAppSelector((s) => s.settings.settings?.scriptCps)
	const scriptCps = resolveEffectiveScriptCps({ userScriptCps, settingsCps })
	const includeTech = canSeeTechPieces(userRole)

	const [name, setName] = useState(livePart.name)
	const [script, setScript] = useState(livePart.script ?? '')
	const [float, setFloat] = useState(livePart.float)
	const [skip, setSkip] = useState(Boolean(livePart.skip))
	const [editorChecked, setEditorChecked] = useState(Boolean(livePart.editorChecked))
	const [duration, setDuration] = useState<number | null | undefined>(livePart.duration)
	const durationRef = useRef(duration)
	const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [weatherSyncing, setWeatherSyncing] = useState(false)

	const hasWeatherPiece = useMemo(
		() => pieces.some((piece) => piece.pieceType === 'weather' && !piece.skip),
		[pieces]
	)

	const commitDuration = (next: number | null | undefined) => {
		durationRef.current = next
		setDuration(next)
	}

	useEffect(() => {
		setName(livePart.name)
		setScript(livePart.script ?? '')
		setFloat(livePart.float)
		setSkip(Boolean(livePart.skip))
		setEditorChecked(Boolean(livePart.editorChecked))
		durationRef.current = livePart.duration
		setDuration(livePart.duration)
	}, [livePart, part.id])

	const expandedPiece = useMemo(
		() => pieces.find((p) => p.id === expandedPieceId) ?? null,
		[pieces, expandedPieceId]
	)

	const addableTypes = toolbarManifests(manifests, TypeManifestEntity.Piece, {
		includeTechOnly: includeTech
	})
	const l3dVariants = toolbarGroupedManifests(manifests, TypeManifestEntity.Piece, 'l3d', {
		includeTechOnly: includeTech
	})

	const savePart = async () => {
		if (readOnly) return
		setSaving(true)
		try {
			await dispatch(
				updatePart({
					part: {
						...livePart,
						name,
						script,
						float,
						skip,
						editorChecked,
						duration: durationRef.current
					}
				})
			).unwrap()
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Saving story',
				bodyContent: 'Encountered an unexpected error'
			})
		} finally {
			setSaving(false)
		}
	}

	const syncWeather = async () => {
		if (readOnly || !hasWeatherPiece) return
		setWeatherSyncing(true)
		try {
			const result = await syncWeatherFromImeteo(livePart.id)
			setScript(result.forecastText)
			toasts.show({
				headerContent: 'Weather synced',
				bodyContent: `${result.cities.length} cities from iMeteo (${result.date} / ${result.day})`
			})
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Weather sync failed',
				bodyContent: e instanceof Error ? e.message : 'Encountered an unexpected error'
			})
		} finally {
			setWeatherSyncing(false)
		}
	}

	/** New pieces land at the front of the script (offset 0) so zero-delay cues stay compacted. */
	const insertPieceAtFront = async (pieceType: string) => {
		const offset = 0
		const startSeconds = 0
		try {
			const created = await dispatch(
				addNewPiece({
					playlistId: livePart.playlistId,
					rundownId: livePart.rundownId,
					segmentId: livePart.segmentId,
					partId: livePart.id,
					pieceType,
					name:
						findTypeManifest(manifests, pieceType, TypeManifestEntity.Piece)?.name ?? pieceType,
					payload: { scriptOffset: offset }
				})
			).unwrap()
			await dispatch(
				updatePiece({
					piece: {
						...created,
						start: startSeconds,
						payload: { ...created.payload, scriptOffset: offset }
					}
				})
			).unwrap()
			setExpandedPieceId(created.id)
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Adding piece',
				bodyContent: 'Encountered an unexpected error'
			})
		}
	}

	const placePieceAtOffset = async (piece: Piece, scriptOffset: number) => {
		const startSeconds = scriptCps > 0 ? scriptOffset / scriptCps : 0
		try {
			await dispatch(
				updatePiece({
					piece: {
						...piece,
						start: startSeconds,
						payload: { ...piece.payload, scriptOffset }
					}
				})
			).unwrap()
		} catch (e) {
			console.error(e)
		}
	}

	return (
		<div
			className="part-expanded-panel"
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
			onPointerDown={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		>
			<div className="part-expanded-panel__meta">
				<Form.Control
					size="sm"
					value={name}
					disabled={readOnly}
					onChange={(e) => setName(e.target.value)}
					aria-label="Story title"
				/>
				<div className="part-expanded-panel__toggles">
					<Form.Check
						type="switch"
						id={`float-${livePart.id}`}
						label="Floated"
						checked={float}
						disabled={readOnly}
						onChange={(e) => setFloat(e.target.checked)}
					/>
					<Form.Check
						type="switch"
						id={`skip-${livePart.id}`}
						label="Skipped"
						checked={skip}
						disabled={readOnly}
						onChange={(e) => setSkip(e.target.checked)}
					/>
					<Form.Check
						type="switch"
						id={`checked-${livePart.id}`}
						label="Checked"
						checked={editorChecked}
						disabled={readOnly}
						onChange={(e) => setEditorChecked(e.target.checked)}
					/>
					<ClockDurationInput
						style={{ width: '6.5rem' }}
						valueSeconds={duration}
						placeholder="mm:ss"
						aria-label="On air duration"
						disabled={readOnly}
						onCommit={commitDuration}
					/>
					{readOnly ? (
						<span className="part-expanded-panel__readonly">
							{userRole === 'viewer' ? 'Viewer — read-only' : 'On air — script is read-only'}
						</span>
					) : (
						<>
							{hasWeatherPiece && includeTech && (
								<Button
									size="sm"
									variant="outline-info"
									disabled={weatherSyncing || saving}
									onClick={() => void syncWeather()}
									title="Fetch forecast from iMeteo and fill cities + script"
								>
									{weatherSyncing ? 'Syncing…' : 'Sync from iMeteo'}
								</Button>
							)}
							<DeletePartButton
								rundownId={livePart.rundownId}
								segmentId={livePart.segmentId}
								partId={livePart.id}
								partName={name || livePart.name}
								disabled={saving}
								size="sm"
								onDeleted={() => setExpandedPartId(null)}
							/>
							<Button size="sm" variant="primary" disabled={saving} onClick={() => void savePart()}>
								{saving ? 'Saving…' : 'Save'}
							</Button>
						</>
					)}
				</div>
			</div>

			<label className="part-expanded-panel__label" htmlFor={`script-${livePart.id}`}>
				Script
			</label>
			<Form.Control
				id={`script-${livePart.id}`}
				as="textarea"
				rows={5}
				value={script}
				readOnly={readOnly}
				onChange={(e) => setScript(e.target.value)}
				onBlur={() => {
					if (!readOnly) void savePart()
				}}
			/>
			<ScriptReadingCounter text={script} />

			<div className="part-expanded-panel__label">Cues in script</div>
			<ScriptPieceFlow
				script={script}
				pieces={pieces}
				cps={scriptCps}
				expandedPieceId={expandedPieceId}
				onSelectPiece={readOnly ? () => undefined : setExpandedPieceId}
				onMovePiece={
					readOnly
						? undefined
						: (pieceId, scriptOffset) => {
								const piece = pieces.find((p) => p.id === pieceId)
								if (piece) void placePieceAtOffset(piece, scriptOffset)
							}
				}
				draggable={!readOnly}
				readiness={readiness}
			/>

			{!readOnly && expandedPiece ? (
				<div className="part-expanded-piece">
					<PiecePropertiesForm piece={expandedPiece} />
					<div className="part-expanded-piece__actions">
						<Button
							size="sm"
							variant="outline-secondary"
							onClick={() => void placePieceAtOffset(expandedPiece, 0)}
						>
							Cue at start
						</Button>
						<Button
							size="sm"
							variant="outline-secondary"
							onClick={() => void placePieceAtOffset(expandedPiece, script.length)}
						>
							Cue at end
						</Button>
						<Button size="sm" variant="outline-secondary" onClick={() => setExpandedPieceId(null)}>
							Close piece
						</Button>
					</div>
				</div>
			) : null}

			{readOnly ? null : (
				<Stack direction="horizontal" gap={1} className="part-expanded-panel__add flex-wrap">
					{l3dVariants.length > 0 ? (
						<Dropdown>
							<Dropdown.Toggle
								as="button"
								type="button"
								className="script-add-piece"
								style={{ borderColor: l3dVariants[0]?.colour ?? '#8c564b' }}
							>
								+ L3D
							</Dropdown.Toggle>
							<Dropdown.Menu>
								{l3dVariants.map((manifest) => (
									<Dropdown.Item
										key={manifest.id}
										onClick={() => void insertPieceAtFront(manifest.id)}
									>
										{L3D_VARIANT_LABELS[manifest.id] ?? manifest.name}
									</Dropdown.Item>
								))}
							</Dropdown.Menu>
						</Dropdown>
					) : null}
					{addableTypes.map((manifest) => (
						<button
							key={manifest.id}
							type="button"
							className="script-add-piece"
							style={{ borderColor: manifest.colour }}
							onClick={() => void insertPieceAtFront(manifest.id)}
						>
							+ {manifest.shortName ?? manifest.name}
						</button>
					))}
				</Stack>
			)}
		</div>
	)
}
