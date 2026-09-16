import { useRef, useState, type DragEvent, type ReactNode } from 'react'
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

/** Custom piece drags must not bubble — react-dnd HTML5Backend cancels unknown drag types. */
function isolatePieceDragEvent(e: DragEvent) {
	e.stopPropagation()
}

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

/**
 * Map a caret position inside a `.script-flow__text` node to an index within its
 * full text content (ignoring the caret marker element).
 */
export function offsetWithinScriptTextElement(
	textEl: HTMLElement,
	node: Node,
	nodeOffset: number
): number {
	if (node === textEl) {
		let total = 0
		for (let i = 0; i < nodeOffset && i < textEl.childNodes.length; i++) {
			const child = textEl.childNodes[i]
			if (child.nodeType === Node.TEXT_NODE) {
				total += child.textContent?.length ?? 0
			}
		}
		return total
	}

	if (node instanceof Element && node.classList.contains('script-flow__caret')) {
		let total = 0
		for (const child of textEl.childNodes) {
			if (child === node) return total
			if (child.nodeType === Node.TEXT_NODE) {
				total += child.textContent?.length ?? 0
			}
		}
		return total
	}

	let total = 0
	const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT)
	let current: Node | null
	while ((current = walker.nextNode())) {
		if (current === node) {
			return total + Math.max(0, Math.min(current.textContent?.length ?? 0, nodeOffset))
		}
		total += current.textContent?.length ?? 0
	}
	return total
}

/** Character offset within a text slice from pointer coords; null if caret APIs fail. */
export function localOffsetFromClientPoint(
	textEl: HTMLElement,
	clientX: number,
	clientY: number,
	sliceLength: number
): number | null {
	const doc = document as Document & {
		caretRangeFromPoint?: (x: number, y: number) => Range | null
		caretPositionFromPoint?: (
			x: number,
			y: number
		) => { offsetNode: Node; offset: number } | null
	}

	let caret: { node: Node; offset: number } | null = null
	if (typeof doc.caretRangeFromPoint === 'function') {
		const range = doc.caretRangeFromPoint(clientX, clientY)
		if (range) caret = { node: range.startContainer, offset: range.startOffset }
	} else if (typeof doc.caretPositionFromPoint === 'function') {
		const pos = doc.caretPositionFromPoint(clientX, clientY)
		if (pos) caret = { node: pos.offsetNode, offset: pos.offset }
	}
	if (!caret) return null
	if (!textEl.contains(caret.node) && caret.node !== textEl) return null
	return Math.max(
		0,
		Math.min(sliceLength, offsetWithinScriptTextElement(textEl, caret.node, caret.offset))
	)
}

function approxLocalOffsetFromRatio(el: HTMLElement, offsetX: number, sliceLength: number): number {
	if (!sliceLength) return 0
	const ratio = offsetX / Math.max(1, el.offsetWidth)
	return Math.max(0, Math.min(sliceLength, Math.round(ratio * sliceLength)))
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

	const clampScriptOffset = (rawOffset: number) =>
		Math.max(0, Math.min(script.length, Math.floor(rawOffset)))

	const handleDropAt = (rawOffset: number) => {
		const pieceId = dragPieceIdRef.current
		if (!pieceId || !onMovePiece) return
		onMovePiece(pieceId, clampScriptOffset(rawOffset))
		setDragOverOffset(null)
		dragPieceIdRef.current = null
	}

	const offsetFromTextDragEvent = (e: DragEvent, from: number, sliceLength: number) => {
		const el = e.currentTarget as HTMLElement
		const local =
			localOffsetFromClientPoint(el, e.clientX, e.clientY, sliceLength) ??
			approxLocalOffsetFromRatio(el, e.nativeEvent.offsetX, sliceLength)
		return from + local
	}

	const nodes: ReactNode[] = []
	let cursor = 0

	const pushTextSlice = (from: number, to: number) => {
		if (to <= from) return
		const slice = script.slice(from, to)
		const showDrop =
			dragOverOffset !== null && dragOverOffset >= from && dragOverOffset <= to
		const caretLocal = showDrop && dragOverOffset !== null ? dragOverOffset - from : null
		nodes.push(
			<span
				key={`t-${from}-${to}`}
				className={`script-flow__text${showDrop ? ' script-flow__text--drop' : ''}`}
				onDragOver={(e) => {
					if (!draggable || !onMovePiece) return
					e.preventDefault()
					isolatePieceDragEvent(e)
					setDragOverOffset(offsetFromTextDragEvent(e, from, slice.length))
				}}
				onDrop={(e) => {
					if (!draggable || !onMovePiece) return
					e.preventDefault()
					isolatePieceDragEvent(e)
					handleDropAt(offsetFromTextDragEvent(e, from, slice.length))
				}}
			>
				{caretLocal === null ? (
					slice
				) : (
					<>
						{slice.slice(0, caretLocal)}
						<span className="script-flow__caret" aria-hidden />
						{slice.slice(caretLocal)}
					</>
				)}
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
		const chipDraggable = draggable && !selected && Boolean(onMovePiece)
		const displayName = resolvePieceName(manifest, piece.payload, piece.name)

		nodes.push(
			<span
				key={piece.id}
				role="button"
				tabIndex={0}
				draggable={chipDraggable}
				className={`script-flow__chip${selected ? ' script-flow__chip--open' : ''}${piece.skip ? ' script-flow__chip--skip' : ''}${dragOverOffset === offset ? ' script-flow__chip--drop-before' : ''}`}
				style={{ borderColor: colour, backgroundColor: colorMix(colour, 0.22) }}
				title={`${displayName} · ${cue}${chipDraggable ? ' · drag to reposition' : ''}`}
				onDragStart={(e) => {
					if (!chipDraggable) return
					e.dataTransfer.setData(L3D_DRAG_TYPE, piece.id)
					e.dataTransfer.effectAllowed = 'move'
					dragPieceIdRef.current = piece.id
					isolatePieceDragEvent(e)
				}}
				onDragEnd={(e) => {
					isolatePieceDragEvent(e)
					setDragOverOffset(null)
					dragPieceIdRef.current = null
				}}
				onDragOver={(e) => {
					if (!draggable || !onMovePiece) return
					e.preventDefault()
					isolatePieceDragEvent(e)
					setDragOverOffset(offset)
				}}
				onDrop={(e) => {
					if (!draggable || !onMovePiece) return
					e.preventDefault()
					isolatePieceDragEvent(e)
					handleDropAt(offset)
				}}
				onClick={(e) => {
					e.stopPropagation()
					onSelectPiece(selected ? null : piece.id)
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault()
						onSelectPiece(selected ? null : piece.id)
					}
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
			</span>
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
					isolatePieceDragEvent(e)
					setDragOverOffset(script.length)
				}}
				onDrop={(e) => {
					e.preventDefault()
					isolatePieceDragEvent(e)
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
