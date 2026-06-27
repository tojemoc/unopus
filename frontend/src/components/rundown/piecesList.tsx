import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '~/store/app'
import './piecesList.scss'
import { addNewPiece, copyPiece } from '~/store/pieces'
import type { Part, Piece } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { toTime } from '~/util/lib'
import { createSelector } from '@reduxjs/toolkit'
import { IconButton } from '../iconButton'
import { useToasts } from '../toasts/useToasts'
import { findTypeManifest, normalizeTypeId, toolbarManifests } from '~/util/typeManifest'
import { useRundownReadiness } from '~/hooks/useRundownReadiness'
import { ReadinessBadge } from './readinessBadge'
import { getPieceReadinessState } from './sidebar/partRow'

const selectPiecesByPart = createSelector(
	[
		(state) => state.pieces.pieces,
		(_state, props: { rundownId: string; segmentId: string; partId: string }) => props
	],
	(pieces, props) =>
		pieces.filter(
			(p: Piece) =>
				p.rundownId === props.rundownId &&
				p.segmentId === props.segmentId &&
				p.partId === props.partId
		)
)

export function PiecesList({ part }: { part: Part }) {
	const { rundownId, segmentId, id: partId } = part
	const partIds = useMemo(() => ({ rundownId, segmentId, partId }), [rundownId, segmentId, partId])

	const pieces = useAppSelector((state) => selectPiecesByPart(state, partIds))
	const { readiness } = useRundownReadiness(rundownId)

	return (
		<table className="pieces-table rundown-pieces-list">
			<thead>
				<tr>
					<th>Status</th>
					<th>Type</th>
					<th>Item</th>
					<th aria-label="Copy" />
					<th>Start</th>
					<th>Dur</th>
				</tr>
			</thead>
			<tbody>
				{pieces.map((piece: Piece) => (
					<PieceRow key={piece.id} piece={piece} readiness={readiness} />
				))}

				<tr>
					<td colSpan={6}>
						<NewPieceButtons part={part} existingPieces={pieces} />
					</td>
				</tr>
			</tbody>
		</table>
	)
}

function PieceRow({
	piece,
	readiness
}: {
	piece: Piece
	readiness: ReturnType<typeof useRundownReadiness>['readiness']
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()

	const manifest = useAppSelector((state) =>
		findTypeManifest(state.typeManifests.manifests, piece.pieceType)
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
			<td>
				<ReadinessBadge state={pieceReadiness.state} tooltip={pieceReadiness.tooltip} compact />
			</td>
			<td className="piece-type" style={{ backgroundColor: manifest?.colour }}>
				{manifest?.shortName || piece.pieceType}
			</td>
			<td className="piece-name">{piece.name}</td>
			<td>
				<IconButton onClick={performCopyPiece} />
			</td>
			<td className="piece-start">{piece.start !== undefined ? toTime(piece.start) : ''}</td>
			<td className="piece-duration">
				{piece.duration !== undefined ? toTime(piece.duration) : ''}
			</td>
		</tr>
	)
}

function NewPieceButtons({ part, existingPieces }: { part: Part; existingPieces: Piece[] }) {
	const navigate = useNavigate({})
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	const typeManifests = useAppSelector((state) => state.typeManifests.manifests)
	const pieceManifests = toolbarManifests(typeManifests, TypeManifestEntity.Piece)
	const partManifest = findTypeManifest(typeManifests, part.partType)

	const addablePieceTypes = useMemo(() => {
		const existingPieceTypes = new Set(
			existingPieces.map((p) => normalizeTypeId(typeManifests, p.pieceType))
		)

		if (part.fromPreset && partManifest?.defaultPieces?.length) {
			const presetTypes = new Set(
				partManifest.defaultPieces
					.filter((t) => !t.optional)
					.map((t) => normalizeTypeId(typeManifests, t.pieceType))
			)
			const optionalTypes = partManifest.defaultPieces
				.filter(
					(t) =>
						t.optional && !existingPieceTypes.has(normalizeTypeId(typeManifests, t.pieceType))
				)
				.map((t) => normalizeTypeId(typeManifests, t.pieceType))

			const extras = pieceManifests
				.filter(
					(m) => !presetTypes.has(m.id) && !existingPieceTypes.has(normalizeTypeId(typeManifests, m.id))
				)
				.map((m) => m.id)

			return [...new Set([...optionalTypes, ...extras])]
		}

		return pieceManifests
			.filter((m) => !existingPieceTypes.has(normalizeTypeId(typeManifests, m.id)))
			.map((m) => m.id)
	}, [part.fromPreset, partManifest, pieceManifests, existingPieces, typeManifests])

	if (!addablePieceTypes.length) return null

	const performCreatePiece = (pieceType: string) => {
		const resolvedPieceType = normalizeTypeId(typeManifests, pieceType)
		const manifest = findTypeManifest(typeManifests, resolvedPieceType)
		const defaultPayload =
			partManifest?.defaultPieces?.find(
				(t) => normalizeTypeId(typeManifests, t.pieceType) === resolvedPieceType
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
				const manifest = findTypeManifest(typeManifests, pieceType)
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
