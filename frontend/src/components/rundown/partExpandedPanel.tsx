import { useEffect, useMemo, useState } from 'react'
import { Button, Form, Stack } from 'react-bootstrap'
import type { Part, Piece } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { updatePart } from '~/store/parts'
import { addNewPiece, updatePiece } from '~/store/pieces'
import { useToasts } from '../toasts/useToasts'
import { ScriptReadingCounter } from './scriptReadingCounter'
import { ScriptPieceFlow } from './scriptPieceFlow'
import { PiecePropertiesForm } from './piecePropertiesForm'
import { findTypeManifest, toolbarManifests } from '~/util/typeManifest'
import { resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { usePresenceFocus } from '~/hooks/usePresence'
import { useRundownReadinessContext } from '~/hooks/RundownReadinessContext'

export function PartExpandedPanel({ part }: { part: Part }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const { readiness } = useRundownReadinessContext()

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
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const settingsCps = useAppSelector((s) => s.settings.settings?.scriptCps)
	const scriptCps = resolveEffectiveScriptCps({ userScriptCps, settingsCps })

	const [name, setName] = useState(livePart.name)
	const [script, setScript] = useState(livePart.script ?? '')
	const [float, setFloat] = useState(livePart.float)
	const [skip, setSkip] = useState(Boolean(livePart.skip))
	const [editorChecked, setEditorChecked] = useState(Boolean(livePart.editorChecked))
	const [duration, setDuration] = useState<number | undefined>(livePart.duration)
	const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		setName(livePart.name)
		setScript(livePart.script ?? '')
		setFloat(livePart.float)
		setSkip(Boolean(livePart.skip))
		setEditorChecked(Boolean(livePart.editorChecked))
		setDuration(livePart.duration)
	}, [livePart, part.id])

	const expandedPiece = useMemo(
		() => pieces.find((p) => p.id === expandedPieceId) ?? null,
		[pieces, expandedPieceId]
	)

	const addableTypes = toolbarManifests(manifests, TypeManifestEntity.Piece)

	const savePart = async () => {
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
						duration
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

	const insertPieceAtEnd = async (pieceType: string) => {
		const offset = script.length
		const startSeconds = scriptCps > 0 ? offset / scriptCps : 0
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
		>
			<div className="part-expanded-panel__meta">
				<Form.Control
					size="sm"
					value={name}
					onChange={(e) => setName(e.target.value)}
					aria-label="Story title"
				/>
				<div className="part-expanded-panel__toggles">
					<Form.Check
						type="switch"
						id={`float-${livePart.id}`}
						label="Floated"
						checked={float}
						onChange={(e) => setFloat(e.target.checked)}
					/>
					<Form.Check
						type="switch"
						id={`skip-${livePart.id}`}
						label="Skipped"
						checked={skip}
						onChange={(e) => setSkip(e.target.checked)}
					/>
					<Form.Check
						type="switch"
						id={`checked-${livePart.id}`}
						label="Checked"
						checked={editorChecked}
						onChange={(e) => setEditorChecked(e.target.checked)}
					/>
					<Form.Control
						size="sm"
						type="number"
						style={{ width: '5.5rem' }}
						value={duration ?? ''}
						placeholder="Dur s"
						aria-label="Duration seconds"
						onChange={(e) =>
							setDuration(e.target.value === '' ? undefined : Number(e.target.value))
						}
					/>
					<Button size="sm" variant="primary" disabled={saving} onClick={() => void savePart()}>
						{saving ? 'Saving…' : 'Save'}
					</Button>
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
				onChange={(e) => setScript(e.target.value)}
				onBlur={() => void savePart()}
			/>
			<ScriptReadingCounter text={script} />

			<div className="part-expanded-panel__label">Cues in script</div>
			<ScriptPieceFlow
				script={script}
				pieces={pieces}
				cps={scriptCps}
				expandedPieceId={expandedPieceId}
				onSelectPiece={setExpandedPieceId}
				readiness={readiness}
			/>

			{expandedPiece ? (
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

			<Stack direction="horizontal" gap={1} className="part-expanded-panel__add flex-wrap">
				{addableTypes.map((manifest) => (
					<button
						key={manifest.id}
						type="button"
						className="script-add-piece"
						style={{ borderColor: manifest.colour }}
						onClick={() => void insertPieceAtEnd(manifest.id)}
					>
						+ {manifest.shortName ?? manifest.name}
					</button>
				))}
			</Stack>
		</div>
	)
}
