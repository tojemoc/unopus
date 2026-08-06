import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Alert, Button, Form, Stack, Table } from 'react-bootstrap'
import {
	ManifestFieldType,
	TypeManifestEntity,
	type Part,
	type PayloadManifest,
	type Piece
} from '~backend/background/interfaces'
import { MediaPickerField } from '~/components/rundown/mediaPickerField'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { updatePart } from '~/store/parts'
import { updatePiece } from '~/store/pieces'

export const Route = createFileRoute('/rundown/$rundownId/rewrite')({
	component: DailyRewritePage
})

type RowSaveState = 'idle' | 'saving' | 'saved' | 'error'

type EditablePieceField = {
	kind: 'piece'
	piece: Piece
	field: PayloadManifest
	key: string
}

type EditablePartScript = {
	kind: 'partScript'
	part: Part
	key: string
}

type EditableRow = EditablePieceField | EditablePartScript

function coerceFieldValue(field: PayloadManifest, value: string) {
	if (field.type === ManifestFieldType.Number) return value === '' ? undefined : Number(value)
	if (field.type === ManifestFieldType.Boolean) return value === 'true'
	return value
}

function DailyRewritePage() {
	const { rundownId } = Route.useParams()
	const dispatch = useAppDispatch()
	const rundown = useAppSelector((state) => state.rundowns.find((r) => r.id === rundownId))
	const segments = useAppSelector((state) =>
		state.segments.segments
			.filter((segment) => segment.rundownId === rundownId)
			.slice()
			.sort((a, b) => a.rank - b.rank)
	)
	const parts = useAppSelector((state) =>
		state.parts.parts.filter((part) => part.rundownId === rundownId)
	)
	const pieces = useAppSelector((state) =>
		state.pieces.pieces.filter((piece) => piece.rundownId === rundownId)
	)
	const manifests = useAppSelector((state) => state.typeManifests.manifests ?? [])

	const pieceManifestByType = useMemo(() => {
		const map = new Map<string, (typeof manifests)[number]>()
		for (const manifest of manifests) {
			if (manifest.entityType === TypeManifestEntity.Piece) {
				map.set(manifest.id, manifest)
			}
		}
		return map
	}, [manifests])

	const [drafts, setDrafts] = useState<Record<string, string>>({})
	const [rowState, setRowState] = useState<Record<string, RowSaveState>>({})
	const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
	const [savingAll, setSavingAll] = useState(false)

	const structure = useMemo(() => {
		return segments.map((segment) => {
			const segmentParts = parts
				.filter((part) => part.segmentId === segment.id)
				.slice()
				.sort((a, b) => a.rank - b.rank)
			return {
				segment,
				parts: segmentParts.map((part) => {
					const partPieces = pieces
						.filter((piece) => piece.partId === part.id)
						.slice()
						.sort((a, b) => a.name.localeCompare(b.name))
					const rows: EditableRow[] = [
						{
							kind: 'partScript',
							part,
							key: `part-script:${part.id}`
						}
					]
					for (const piece of partPieces) {
						const manifest = pieceManifestByType.get(piece.pieceType)
						const dailyFields = (manifest?.payload ?? []).filter(
							(field) => field.dailyEditable === true
						)
						for (const field of dailyFields) {
							rows.push({
								kind: 'piece',
								piece,
								field,
								key: `piece:${piece.id}:${field.id}`
							})
						}
					}
					return { part, rows }
				})
			}
		})
	}, [segments, parts, pieces, pieceManifestByType])

	const getValue = (row: EditableRow): string => {
		if (drafts[row.key] !== undefined) {
			return drafts[row.key]
		}
		if (row.kind === 'partScript') {
			return row.part.script ?? ''
		}
		const raw = row.piece.payload?.[row.field.id]
		return raw === undefined || raw === null ? '' : String(raw)
	}

	const setValue = (key: string, value: string) => {
		setDrafts((prev) => ({ ...prev, [key]: value }))
		setRowState((prev) => ({ ...prev, [key]: 'idle' }))
	}

	const clearDraftKeys = (keys: string[]) => {
		setDrafts((prev) => {
			const next = { ...prev }
			for (const key of keys) delete next[key]
			return next
		})
	}

	const saveRow = async (row: EditableRow): Promise<boolean> => {
		setRowState((prev) => ({ ...prev, [row.key]: 'saving' }))
		setRowErrors((prev) => {
			const next = { ...prev }
			delete next[row.key]
			return next
		})
		try {
			const value = getValue(row)
			if (row.kind === 'partScript') {
				await dispatch(
					updatePart({
						part: {
							...row.part,
							script: value
						}
					})
				).unwrap()
			} else {
				const nextPayload = {
					...(row.piece.payload ?? {}),
					[row.field.id]: coerceFieldValue(row.field, value)
				}
				await dispatch(
					updatePiece({
						piece: {
							...row.piece,
							payload: nextPayload
						}
					})
				).unwrap()
			}
			setRowState((prev) => ({ ...prev, [row.key]: 'saved' }))
			clearDraftKeys([row.key])
			return true
		} catch (error) {
			setRowState((prev) => ({ ...prev, [row.key]: 'error' }))
			setRowErrors((prev) => ({
				...prev,
				[row.key]: error instanceof Error ? error.message : 'Save failed'
			}))
			return false
		}
	}

	const savePieceGroup = async (groupRows: EditablePieceField[]): Promise<boolean> => {
		const keys = groupRows.map((row) => row.key)
		setRowState((prev) => {
			const next = { ...prev }
			for (const key of keys) next[key] = 'saving'
			return next
		})
		setRowErrors((prev) => {
			const next = { ...prev }
			for (const key of keys) delete next[key]
			return next
		})
		try {
			const piece = groupRows[0].piece
			const nextPayload = { ...(piece.payload ?? {}) }
			for (const row of groupRows) {
				nextPayload[row.field.id] = coerceFieldValue(row.field, getValue(row))
			}
			await dispatch(
				updatePiece({
					piece: {
						...piece,
						payload: nextPayload
					}
				})
			).unwrap()
			setRowState((prev) => {
				const next = { ...prev }
				for (const key of keys) next[key] = 'saved'
				return next
			})
			clearDraftKeys(keys)
			return true
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Save failed'
			setRowState((prev) => {
				const next = { ...prev }
				for (const key of keys) next[key] = 'error'
				return next
			})
			setRowErrors((prev) => {
				const next = { ...prev }
				for (const key of keys) next[key] = message
				return next
			})
			return false
		}
	}

	const saveRowsGrouped = async (rows: EditableRow[]) => {
		const partScriptRows = rows.filter((row): row is EditablePartScript => row.kind === 'partScript')
		const pieceRows = rows.filter((row): row is EditablePieceField => row.kind === 'piece')

		for (const row of partScriptRows) {
			await saveRow(row)
		}

		const byPieceId = new Map<string, EditablePieceField[]>()
		for (const row of pieceRows) {
			const list = byPieceId.get(row.piece.id) ?? []
			list.push(row)
			byPieceId.set(row.piece.id, list)
		}
		for (const group of byPieceId.values()) {
			await savePieceGroup(group)
		}
	}

	const dirtyRows = useMemo(() => {
		const rows: EditableRow[] = []
		for (const group of structure) {
			for (const partGroup of group.parts) {
				for (const row of partGroup.rows) {
					if (drafts[row.key] !== undefined) {
						rows.push(row)
					}
				}
			}
		}
		return rows
	}, [structure, drafts])

	const failedRows = useMemo(() => {
		const rows: EditableRow[] = []
		for (const group of structure) {
			for (const partGroup of group.parts) {
				for (const row of partGroup.rows) {
					if (rowState[row.key] === 'error') {
						rows.push(row)
					}
				}
			}
		}
		return rows
	}, [structure, rowState])

	const saveAllDirty = async () => {
		setSavingAll(true)
		await saveRowsGrouped(dirtyRows)
		setSavingAll(false)
	}

	const retryFailed = async () => {
		setSavingAll(true)
		await saveRowsGrouped(failedRows)
		setSavingAll(false)
	}

	if (!rundown) {
		return <Alert variant="warning">Rundown not found</Alert>
	}

	const hasDailyEditablePieceFields = structure.some((group) =>
		group.parts.some((partGroup) => partGroup.rows.some((row) => row.kind === 'piece'))
	)

	return (
		<div className="p-3" style={{ overflow: 'auto', height: '100%' }}>
			<Stack direction="horizontal" className="mb-3 align-items-center" gap={2}>
				<div>
					<h2 className="h4 mb-0">Daily rewrite</h2>
					<div className="text-muted small">{rundown.name}</div>
				</div>
				<div className="ms-auto d-flex gap-2">
					<Button
						variant="primary"
						disabled={savingAll || dirtyRows.length === 0}
						onClick={() => void saveAllDirty()}
					>
						{savingAll ? 'Saving…' : `Save changes (${dirtyRows.length})`}
					</Button>
					{failedRows.length > 0 && (
						<Button
							variant="outline-danger"
							disabled={savingAll}
							onClick={() => void retryFailed()}
						>
							Retry failed ({failedRows.length})
						</Button>
					)}
					<Link to="/rundown/$rundownId" params={{ rundownId }} className="btn btn-outline-secondary">
						Back
					</Link>
				</div>
			</Stack>

			{!hasDailyEditablePieceFields && (
				<Alert variant="info">
					No piece fields are marked <code>dailyEditable</code> in the loaded type manifests yet.
					After the megarepo asset pin includes that flag, use{' '}
					<strong>Settings → Connection → Reload type manifests</strong>. Part prompter/script
					rows are still editable below.
				</Alert>
			)}

			{structure.map(({ segment, parts: partGroups }) => (
				<section key={segment.id} className="mb-4">
					<h3 className="h5">{segment.name}</h3>
					{partGroups.map(({ part, rows }) => (
						<div key={part.id} className="mb-3">
							<h4 className="h6 text-muted">
								{part.name}
								<span className="ms-2 small">({part.partType})</span>
							</h4>
							<Table bordered size="sm" responsive className="align-middle">
								<thead>
									<tr>
										<th style={{ width: '18%' }}>Piece / field</th>
										<th>Value</th>
										<th style={{ width: '140px' }}>Status</th>
										<th style={{ width: '90px' }} />
									</tr>
								</thead>
								<tbody>
									{rows.map((row) => (
										<RewriteRow
											key={row.key}
											row={row}
											value={getValue(row)}
											state={rowState[row.key] ?? 'idle'}
											error={rowErrors[row.key]}
											rundownId={rundownId}
											onChange={(value) => setValue(row.key, value)}
											onSave={() => void saveRow(row)}
										/>
									))}
								</tbody>
							</Table>
						</div>
					))}
				</section>
			))}
		</div>
	)
}

function RewriteRow({
	row,
	value,
	state,
	error,
	rundownId,
	onChange,
	onSave
}: {
	row: EditableRow
	value: string
	state: RowSaveState
	error?: string
	rundownId: string
	onChange: (value: string) => void
	onSave: () => void
}) {
	const label =
		row.kind === 'partScript'
			? 'Prompter / script'
			: `${row.piece.name} · ${row.field.label || row.field.id}`

	const isMedia = row.kind === 'piece' && row.field.type === ManifestFieldType.MediaPick
	const subdir =
		row.kind === 'piece' && row.field.subdir ? row.field.subdir : 'clips'

	return (
		<tr>
			<td>
				<div className="fw-semibold">{label}</div>
				{row.kind === 'piece' && (
					<div className="small text-muted">
						{row.piece.pieceType} / {row.field.id}
					</div>
				)}
			</td>
			<td>
				{isMedia && row.kind === 'piece' ? (
					<MediaPickerField
						rundownId={rundownId}
						subdir={subdir}
						name={row.key}
						value={value}
						onBlur={() => undefined}
						onChange={onChange}
					/>
				) : row.kind === 'partScript' ? (
					<Form.Control
						as="textarea"
						rows={3}
						value={value}
						onChange={(e) => onChange(e.target.value)}
					/>
				) : row.kind === 'piece' && row.field.type === ManifestFieldType.Boolean ? (
					<Form.Select value={value} onChange={(e) => onChange(e.target.value)}>
						<option value="false">No</option>
						<option value="true">Yes</option>
					</Form.Select>
				) : (
					<Form.Control
						type={
							row.kind === 'piece' && row.field.type === ManifestFieldType.Number
								? 'number'
								: 'text'
						}
						value={value}
						onChange={(e) => onChange(e.target.value)}
					/>
				)}
				{error && <div className="text-danger small mt-1">{error}</div>}
			</td>
			<td>
				{state === 'idle' && <span className="text-muted">—</span>}
				{state === 'saving' && <span className="text-muted">Saving…</span>}
				{state === 'saved' && <span className="text-success">Saved</span>}
				{state === 'error' && <span className="text-danger">Error</span>}
			</td>
			<td>
				<Button
					size="sm"
					variant={state === 'error' ? 'outline-danger' : 'outline-primary'}
					disabled={state === 'saving'}
					onClick={onSave}
				>
					{state === 'error' ? 'Retry' : 'Save'}
				</Button>
			</td>
		</tr>
	)
}
