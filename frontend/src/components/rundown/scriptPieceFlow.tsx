import { useRef, useState, type ReactNode } from 'react'
import type { Piece, RundownReadiness, TypeManifest } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { findTypeManifest } from '~/util/typeManifest'
import {
	formatPieceCueOffset,
	resolvePieceScriptOffset,
	sortPiecesByScriptOffset
} from '~/util/pieceScriptOffset'
import { useAppSelector } from '~/store/app'
import { resolvePieceName } from '~/util/pieceName'
import { getPieceReadinessState } from './sidebar/partRow'
import { ReadinessBadge } from './readinessBadge'
import { canSeeTechPieces } from '~/util/roles'

const L3D_DRAG_TYPE = 'application/x-sofie-piece-id'

/** Snap a raw character offset to the nearest word boundary (prefer earlier). */
export function snapScriptOffsetToWordBoundary(script: string, offset: number): number {
	const clamped = Math.max(0, Math.min(script.length, Math.floor(offset)))
	if (clamped <= 0 || clamped >= script.length) return clamped
	if (/\s/.test(script[clamped] ?? '') || /\s/.test(script[clamped - 1] ?? '')) {
		return clamped
	}
	let left = clamped
	while (left > 0 && !/\s/.test(script[left - 1] ?? '')) left--
	let right = clamped
	while (right < script.length && !/\s/.test(script[right] ?? '')) right++
	return clamped - left <= right - clamped ? left : right
}

export function ScriptPieceFlow({
	script,
	pieces,
	cps,
	expandedPieceId,
	onSelectPiece,
	onMovePiece,
	readiness,
	draggable = false
}: {
	script: string
	pieces: Piece[]
	cps: number
	expandedPieceId: string | null
	onSelectPiece: (pieceId: string | null) => void
	onMovePiece?: (pieceId: string, scriptOffset: number) => void
	readiness: RundownReadiness | null
	draggable?: boolean
}) {
	const manifests = useAppSelector((s) => s.typeManifests.manifests)
	const role = useAppSelector((s) => s.auth.user?.role)
	const seeTech = canSeeTechPieces(role)
	const visiblePieces = pieces.filter((piece) => {
		const manifest = findTypeManifest(manifests, piece.pieceType, TypeManifestEntity.Piece)
		return seeTech || !manifest?.techOnly
	})
	const ordered = sortPiecesByScriptOffset(visiblePieces, script.length)
	const [dragOverOffset, setDragOverOffset] = useState<number | null>(null)
	const dragPieceIdRef = useRef<string | null>(null)

	const handleDropAt = (rawOffset: number) => {
		const pieceId = dragPieceIdRef.current
		if (!pieceId || !onMovePiece) return
		onMovePiece(pieceId, snapScriptOffsetToWordBoundary(script, rawOffset))
		setDragOverOffset(null)
		dragPieceIdRef.current = null
	}

	const nodes: ReactNode[] = []
	let cursor = 0

	const pushTextSlice = (from: number, to: number) => {
		if (to <= from) return
		const slice = script.slice(from, to)
		nodes.push(
			<span
				key={`t-${from}-${to}`}
				className={`script-flow__text${dragOverOffset !== null && dragOverOffset >= from && dragOverOffset < to ? ' script-flow__text--drop' : ''}`}
				onDragOver={(e) => {
					if (!draggable || !onMovePiece) return
					e.preventDefault()
					const ratio = slice.length ? e.nativeEvent.offsetX / Math.max(1, (e.currentTarget as HTMLElement).offsetWidth) : 0
					const approx = from + Math.round(ratio * slice.length)
					setDragOverOffset(snapScriptOffsetToWordBoundary(script, approx))
				}}
				onDrop={(e) => {
					if (!draggable || !onMovePiece) return
					e.preventDefault()
					const ratio = slice.length ? e.nativeEvent.offsetX / Math.max(1, (e.currentTarget as HTMLElement).offsetWidth) : 0
					handleDropAt(from + Math.round(ratio * slice.length))
				}}
			>
				{slice}
			</span>
		)
	}

	ordered.forEach((piece) => {
		const offset = resolvePieceScriptOffset(piece, script.length)
		if (offset > cursor) {
			pushTextSlice(cursor, offset)
			cursor = offset
		}

		const manifest = findTypeManifest(manifests, piece.pieceType, TypeManifestEntity.Piece) as
			| TypeManifest
			| undefined
		const colour = manifest?.colour ?? '#666'
		const cue = formatPieceCueOffset(script, piece, cps)
		const pieceReady = getPieceReadinessState(piece.id, readiness)
		const selected = expandedPieceId === piece.id
		const displayName = resolvePieceName(manifest, piece.payload, piece.name)

		nodes.push(
			<button
				key={piece.id}
				type="button"
				draggable={draggable && Boolean(onMovePiece)}
				className={`script-flow__chip${selected ? ' script-flow__chip--open' : ''}${piece.skip ? ' script-flow__chip--skip' : ''}${dragOverOffset === offset ? ' script-flow__chip--drop-before' : ''}`}
				style={{ borderColor: colour, backgroundColor: colorMix(colour, 0.22) }}
				title={`${displayName} · ${cue}${draggable ? ' · drag to reposition' : ''}`}
				onDragStart={(e) => {
					if (!draggable || !onMovePiece) return
					e.dataTransfer.setData(L3D_DRAG_TYPE, piece.id)
					e.dataTransfer.effectAllowed = 'move'
					dragPieceIdRef.current = piece.id
				}}
				onDragEnd={() => {
					setDragOverOffset(null)
					dragPieceIdRef.current = null
				}}
				onDragOver={(e) => {
					if (!draggable || !onMovePiece) return
					e.preventDefault()
					setDragOverOffset(offset)
				}}
				onDrop={(e) => {
					if (!draggable || !onMovePiece) return
					e.preventDefault()
					handleDropAt(offset)
				}}
				onClick={(e) => {
					e.stopPropagation()
					onSelectPiece(selected ? null : piece.id)
				}}
			>
				<span className="script-flow__chip-type" style={{ backgroundColor: colour }}>
					{manifest?.shortName ?? piece.pieceType.slice(0, 4).toUpperCase()}
				</span>
				<span className="script-flow__chip-name">{displayName}</span>
				<span className="script-flow__chip-cue">{cue}</span>
				{pieceReady && pieceReady.state !== 'na' ? (
					<ReadinessBadge state={pieceReady.state} tooltip={pieceReady.tooltip} compact />
				) : null}
			</button>
		)
	})

	if (cursor < script.length) {
		pushTextSlice(cursor, script.length)
	}

	// Drop zone after all text so chips can be moved to the end.
	if (draggable && onMovePiece) {
		nodes.push(
			<span
				key="t-end-drop"
				className="script-flow__end-drop"
				onDragOver={(e) => {
					e.preventDefault()
					setDragOverOffset(script.length)
				}}
				onDrop={(e) => {
					e.preventDefault()
					handleDropAt(script.length)
				}}
			/>
		)
	}

	if (!script && ordered.length === 0) {
		return <div className="script-flow script-flow--empty text-muted">No script yet.</div>
	}

	return <div className="script-flow">{nodes}</div>
}

function colorMix(hex: string, alpha: number): string {
	const cleaned = hex.replace('#', '')
	if (cleaned.length !== 6) return `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`
	const r = parseInt(cleaned.slice(0, 2), 16)
	const g = parseInt(cleaned.slice(2, 4), 16)
	const b = parseInt(cleaned.slice(4, 6), 16)
	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
