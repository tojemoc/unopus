import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '~/store/app'
import './piecesList.scss'
import { addNewPiece, copyPiece, reorderPieces } from '~/store/pieces'
import type { Part, Piece } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { toTime } from '~/util/lib'
import { createSelector } from '@reduxjs/toolkit'
import { IconButton } from '../iconButton'
import { useToasts } from '../toasts/useToasts'
import { findTypeManifest, normalizeTypeId, toolbarManifests } from '~/util/typeManifest'
import { useRundownReadinessContext } from '~/hooks/RundownReadinessContext'
import { ReadinessBadge } from './readinessBadge'
import { getPieceReadinessState } from './sidebar/partRow'
import {
	formatPieceOnAirDuration,
	formatSourceDurationSeconds,
	getPieceSourceDurationSeconds,
	resolvePartOnAirDuration,
	WIPE_CUT_POINT_SECONDS,
	formatSecondsPrecise
} from '~/util/pieceDuration'
import { Button, Stack } from 'react-bootstrap'

function sortPieces(pieces: Piece[]): Piece[] {
	return [...pieces].sort((a, b) => {
		const rankA = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER
		const rankB = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER
		if (rankA !== rankB) return rankA - rankB

		const startA = a.start ?? 0
		const startB = b.start ?? 0
		if (startA !== startB) return startA - startB

		return a.id.localeCompare(b.id)
	})
}

const selectPiecesByPart = createSelector(
	[
		(state) => state.pieces.pieces,
		(_state, props: { rundownId: string; segmentId: string; partId: string }) => props
	],
	(pieces, props) =>
		sortPieces(
			pieces.filter(
				(p: Piece) =>
					p.rundownId === props.rundownId &&
					p.segmentId === props.segmentId &&
					p.partId === props.partId
			)
		)
)

export function PiecesList({ part }: { part: Part }) {
	const { rundownId, segmentId, id: partId } = part
	const partIds = useMemo(() => ({ rundownId, segmentId, partId }), [rundownId, segmentId, partId])
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	const pieces = useAppSelector((state) => selectPiecesByPart(state, partIds))
	const { readiness } = useRundownReadinessContext()

	const showSourceColumn = pieces.some(
		(piece: Piece) => getPieceSourceDurationSeconds(piece) !== undefined
	)

	const effectivePartDuration = useMemo(
		() =>
			resolvePartOnAirDuration(
				part,
				pieces.map((piece: Piece) => ({
					pieceType: piece.pieceType,
					duration: piece.duration
				}))
			),
		[part, pieces]
	)

	const handleReorderPiece = (sourceIndex: number, targetIndex: number) => {
		const piece = pieces[sourceIndex]
		if (!piece || sourceIndex === targetIndex) {
			return
		}

		dispatch(
			reorderPieces({
				element: piece,
				sourceIndex,
				targetIndex
			})
		)
			.unwrap()
			.catch((error) => {
				console.error(error)
				toasts.show({
					headerContent: 'Reordering piece',
					bodyContent: 'Encountered an unexpected error'
				})
			})
	}

	return (
		<table className="pieces-table rundown-pieces-list">
			<thead>
				<tr>
					<th aria-label="Order" />
					<th>Status</th>
					<th>Type</th>
					<th>Item</th>
					<th aria-label="Copy" />
					<th>Start</th>
					<th>On air</th>
					{showSourceColumn ? <th>Source</th> : null}
				</tr>
			</thead>
			<tbody>
				{pieces.map((piece: Piece, index: number) => (
					<PieceRow
						key={piece.id}
						piece={piece}
						isFirst={index === 0}
						isLast={index === pieces.length - 1}
						onMoveUp={() => handleReorderPiece(index, index - 1)}
						onMoveDown={() => handleReorderPiece(index, index + 1)}
						effectivePartDuration={effectivePartDuration}
						readiness={readiness}
						showSourceColumn={showSourceColumn}
					/>
				))}

				<tr>
					<td colSpan={showSourceColumn ? 8 : 7}>
						<NewPieceButtons part={part} existingPieces={pieces} />
					</td>
				</tr>
			</tbody>
		</table>
	)
}

function PieceRow({
	piece,
	isFirst,
	isLast,
	onMoveUp,
	onMoveDown,
	effectivePartDuration,
	readiness,
	showSourceColumn
}: {
	piece: Piece
	isFirst: boolean
	isLast: boolean
	onMoveUp: () => void
	onMoveDown: () => void
	effectivePartDuration: number | undefined
	readiness: ReturnType<typeof useRundownReadinessContext>['readiness']
	showSourceColumn: boolean
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()

	const manifest = useAppSelector((state) =>
		findTypeManifest(state.typeManifests.manifests, piece.pieceType, TypeManifestEntity.Piece)
	)

	const pieceReadiness = getPieceReadinessState(piece.id, readiness)

	const pieceRowClick = () => {
		navigate({
			to: '/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId',
			params: {
				rundownId: piece.rundownId,
				segmentId: piece.segmentId,
				partId: piece.partId,
				pieceId: piece.id
			}
		})
	}

	const performCopyPiece = () => {
		dispatch(
			copyPiece({
				id: piece.id
			})
		)
			.unwrap()
			.then(async (newPiece) => {
				await navigate({
					to: '/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId',
					params: {
						rundownId: newPiece.rundownId,
						segmentId: newPiece.segmentId,
						partId: newPiece.partId,
						pieceId: newPiece.id
					}
				})
			})
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Adding piece',
					bodyContent: 'Encountered an unexpected error'
				})
			})
	}

	return (
		<tr onClick={pieceRowClick}>
			<td onClick={(event) => event.stopPropagation()}>
				<Stack direction="horizontal" gap={1} className="piece-order-controls">
					<Button
						variant="outline-secondary"
						size="sm"
						disabled={isFirst}
						aria-label={`Move ${piece.name} up`}
						onClick={onMoveUp}
					>
						↑
					</Button>
					<Button
						variant="outline-secondary"
						size="sm"
						disabled={isLast}
						aria-label={`Move ${piece.name} down`}
						onClick={onMoveDown}
					>
						↓
					</Button>
				</Stack>
			</td>
			<td>
				{pieceReadiness ? (
					<ReadinessBadge state={pieceReadiness.state} tooltip={pieceReadiness.tooltip} compact />
				) : null}
			</td>
			<td className="piece-type piece-type-chip" style={{ backgroundColor: manifest?.colour }}>
				{manifest?.shortName || piece.pieceType}
			</td>
			<td className="piece-name">{piece.name}</td>
			<td>
				<IconButton onClick={performCopyPiece} />
			</td>
			<td className="piece-start">{piece.start !== undefined ? toTime(piece.start) : ''}</td>
			<td className="piece-duration" title="On-air duration">
				{formatPieceOnAirDuration(piece, effectivePartDuration)}
				{piece.pieceType === 'wipe' ? (
					<span className="wipe-cut-point" title={`Cut point at ${formatSecondsPrecise(WIPE_CUT_POINT_SECONDS)} — content switches when screen is fully covered. Other audio muted during full wipe.`}>
						✂ {formatSecondsPrecise(WIPE_CUT_POINT_SECONDS)}
					</span>
				) : null}
			</td>
			{showSourceColumn ? (
				<td className="piece-duration" title="Source duration (ffprobe)">
					{formatSourceDurationSeconds(getPieceSourceDurationSeconds(piece))}
				</td>
			) : null}
		</tr>
	)
}

function NewPieceButtons({ part, existingPieces }: { part: Part; existingPieces: Piece[] }) {
	const navigate = useNavigate({})
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	const typeManifests = useAppSelector((state) => state.typeManifests.manifests)
	const pieceManifests = toolbarManifests(typeManifests, TypeManifestEntity.Piece)
	const partManifest = findTypeManifest(typeManifests, part.partType, TypeManifestEntity.Part)

	const addablePieceTypes = useMemo(() => {
		const existingPieceTypes = new Set(
			existingPieces.map((p) => normalizeTypeId(typeManifests, p.pieceType, TypeManifestEntity.Piece))
		)

		if (part.fromPreset && partManifest?.defaultPieces?.length) {
			const presetTypes = new Set(
				partManifest.defaultPieces
					.filter((t) => !t.optional)
					.map((t) => normalizeTypeId(typeManifests, t.pieceType, TypeManifestEntity.Piece))
			)
			const optionalTypes = partManifest.defaultPieces
				.filter(
					(t) =>
						t.optional &&
						!existingPieceTypes.has(normalizeTypeId(typeManifests, t.pieceType, TypeManifestEntity.Piece))
				)
				.map((t) => normalizeTypeId(typeManifests, t.pieceType, TypeManifestEntity.Piece))

			const extras = pieceManifests
				.filter(
					(m) =>
						!presetTypes.has(m.id) &&
						!existingPieceTypes.has(normalizeTypeId(typeManifests, m.id, TypeManifestEntity.Piece))
				)
				.map((m) => m.id)

			return [...new Set([...optionalTypes, ...extras])]
		}

		return pieceManifests
			.filter((m) => !existingPieceTypes.has(normalizeTypeId(typeManifests, m.id, TypeManifestEntity.Piece)))
			.map((m) => m.id)
	}, [part.fromPreset, partManifest, pieceManifests, existingPieces, typeManifests])

	if (!addablePieceTypes.length) return null

	const performCreatePiece = (pieceType: string) => {
		const resolvedPieceType = normalizeTypeId(typeManifests, pieceType, TypeManifestEntity.Piece)
		const manifest = findTypeManifest(typeManifests, resolvedPieceType, TypeManifestEntity.Piece)
		const defaultPayload =
			partManifest?.defaultPieces?.find(
				(t) =>
					normalizeTypeId(typeManifests, t.pieceType, TypeManifestEntity.Piece) === resolvedPieceType
			)?.payload ?? {}

		dispatch(
			addNewPiece({
				playlistId: part.playlistId,
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				partId: part.id,
				name: manifest && manifest.includeTypeInName ? manifest.name : 'New piece',
				pieceType: resolvedPieceType,
				payload: defaultPayload
			})
		)
			.unwrap()
			.then(async (piece) => {
				await navigate({
					to: '/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId',
					params: {
						rundownId: part.rundownId,
						segmentId: part.segmentId,
						partId: part.id,
						pieceId: piece.id
					}
				})
			})
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Adding piece',
					bodyContent: 'Encountered an unexpected error'
				})
			})
	}

	return (
		<div className="piece-add-buttons">
			{addablePieceTypes.map((pieceType) => {
				const manifest = findTypeManifest(typeManifests, pieceType, TypeManifestEntity.Piece)
				return (
					<button
						key={pieceType}
						className="add-piece-button mb-1 me-1"
						type="button"
						style={{ borderColor: manifest?.colour }}
						onClick={() => performCreatePiece(pieceType)}
					>
						+ {manifest?.shortName ?? manifest?.name ?? pieceType}
					</button>
				)
			})}
		</div>
	)
}
