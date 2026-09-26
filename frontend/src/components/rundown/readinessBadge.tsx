import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import type { ReadinessStatusSource } from '~backend/background/interfaces'
import { IconClip, IconMediaMissing, IconMediaReady } from '~/components/icons/broadcastIcons'
import './readinessBadge.scss'

export type ReadinessState = 'ready' | 'not-ready' | 'na'

export function ReadinessBadge({
	state,
	tooltip,
	compact = false
}: {
	state: ReadinessState
	tooltip?: string
	compact?: boolean
}) {
	const labels: Record<ReadinessState, string> = {
		ready: compact ? 'R' : 'READY',
		'not-ready': compact ? 'NR' : 'NOT READY',
		na: compact ? '—' : 'N/A'
	}

	const ariaLabels: Record<ReadinessState, string> = {
		ready: 'Ready',
		'not-ready': 'Not ready',
		na: 'Not applicable'
	}

	const icon =
		state === 'ready' ? (
			<IconMediaReady size={compact ? 10 : 12} />
		) : state === 'not-ready' ? (
			<IconMediaMissing size={compact ? 10 : 12} />
		) : (
			<IconClip size={compact ? 10 : 12} />
		)

	const badge = (
		<span
			className={`readiness-badge readiness-badge--${state}${compact ? ' readiness-badge--compact' : ''}`}
			role="status"
			aria-label={ariaLabels[state]}
		>
			<span className="readiness-badge__icon" aria-hidden>
				{icon}
			</span>
			{labels[state]}
		</span>
	)

	if (!tooltip) {
		return badge
	}

	return (
		<OverlayTrigger
			overlay={(overlayProps) => (
				<Tooltip {...overlayProps} className="readiness-badge-tooltip">
					<span className="readiness-badge-tooltip__content">{tooltip}</span>
				</Tooltip>
			)}
		>
			{badge}
		</OverlayTrigger>
	)
}

export type ReadinessProvenanceContext = {
	pieceSource?: ReadinessStatusSource
	coreCallSource?: 'core' | 'core-disconnected' | 'core-error' | 'ignored'
	/** Safe operator-facing label only. */
	coreCallError?: string
}

function formatProvenanceLine(ctx: ReadinessProvenanceContext): string | undefined {
	const source = ctx.pieceSource
	if (!source) {
		return undefined
	}

	if (source === 'core') {
		return 'via Package Manager'
	}

	if (ctx.coreCallSource === 'ignored') {
		return 'via local scan (Sofie media status ignored)'
	}

	if (ctx.coreCallSource === 'core-disconnected') {
		return 'via local scan (Core unreachable)'
	}

	if (ctx.coreCallSource === 'core-error') {
		const label = ctx.coreCallError ?? 'Core content-status call failed'
		return `via local scan (Core: ${label})`
	}

	if (ctx.coreCallSource === 'core') {
		return 'via local scan (not reported by Core)'
	}

	return 'via local scan'
}

export function getPieceReadinessTooltip(
	requirements: {
		fieldId: string
		path: string
		ready: boolean
		reason?: string
		source?: ReadinessStatusSource
	}[],
	provenance?: ReadinessProvenanceContext
): string | undefined {
	if (!requirements.length) {
		return 'No media required'
	}

	const lines = requirements.map((item) => {
		if (item.ready) {
			return `${item.fieldId}: ${item.path || '(empty)'}`
		}
		return `${item.fieldId}: ${item.reason ?? 'Not ready'}`
	})

	const provenanceLine = provenance ? formatProvenanceLine(provenance) : undefined
	if (provenanceLine) {
		lines.push(provenanceLine)
	}

	return lines.join('\n')
}
