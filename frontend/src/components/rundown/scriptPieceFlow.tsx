import type { ReactNode } from 'react'
import type { Piece, RundownReadiness, TypeManifest } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'
import { findTypeManifest } from '~/util/typeManifest'
import {
	formatPieceCueOffset,
	resolvePieceScriptOffset,
	sortPiecesByScriptOffset
} from '~/util/pieceScriptOffset'
import { useAppSelector } from '~/store/app'
import { getPieceReadinessState } from './sidebar/partRow'
import { ReadinessBadge } from './readinessBadge'

export function ScriptPieceFlow({
	script,
	pieces,
	cps,
	expandedPieceId,
	onSelectPiece,
	readiness
}: {
	script: string
	pieces: Piece[]
	cps: number
	expandedPieceId: string | null
	onSelectPiece: (pieceId: string | null) => void
	readiness: RundownReadiness | null
}) {
	const manifests = useAppSelector((s) => s.typeManifests.manifests)
	const ordered = sortPiecesByScriptOffset(pieces, script.length)

	const nodes: ReactNode[] = []
	let cursor = 0

	ordered.forEach((piece) => {
		const offset = resolvePieceScriptOffset(piece, script.length)
		if (offset > cursor) {
			nodes.push(
				<span key={`t-${cursor}-${offset}`} className="script-flow__text">
					{script.slice(cursor, offset)}
				</span>
			)
			cursor = offset
		}

		const manifest = findTypeManifest(manifests, piece.pieceType, TypeManifestEntity.Piece) as
			| TypeManifest
			| undefined
		const colour = manifest?.colour ?? '#666'
		const cue = formatPieceCueOffset(script, piece, cps)
		const pieceReady = getPieceReadinessState(piece.id, readiness)
		const selected = expandedPieceId === piece.id

		nodes.push(
			<button
				key={piece.id}
				type="button"
				className={`script-flow__chip${selected ? ' script-flow__chip--open' : ''}${piece.skip ? ' script-flow__chip--skip' : ''}`}
				style={{ borderColor: colour, backgroundColor: colorMix(colour, 0.22) }}
				title={`${piece.name} · ${cue}`}
				onClick={(e) => {
					e.stopPropagation()
					onSelectPiece(selected ? null : piece.id)
				}}
			>
				<span className="script-flow__chip-type" style={{ backgroundColor: colour }}>
					{manifest?.shortName ?? piece.pieceType.slice(0, 4).toUpperCase()}
				</span>
				<span className="script-flow__chip-name">{piece.name}</span>
				<span className="script-flow__chip-cue">{cue}</span>
				{pieceReady && pieceReady.state !== 'na' ? (
					<ReadinessBadge state={pieceReady.state} tooltip={pieceReady.tooltip} compact />
				) : null}
			</button>
		)
	})

	if (cursor < script.length) {
		nodes.push(
			<span key={`t-end`} className="script-flow__text">
				{script.slice(cursor)}
			</span>
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
