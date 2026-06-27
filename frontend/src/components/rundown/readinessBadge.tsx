import { OverlayTrigger, Tooltip } from 'react-bootstrap'
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

	const badge = (
		<span
			className={`readiness-badge readiness-badge--${state}`}
			role="status"
			aria-label={ariaLabels[state]}
		>
			{labels[state]}
		</span>
	)

	if (!tooltip) {
		return badge
	}

	return (
		<OverlayTrigger
			overlay={
				<Tooltip className="readiness-badge-tooltip">
					<span className="readiness-badge-tooltip__content">{tooltip}</span>
				</Tooltip>
			}
		>
			{badge}
		</OverlayTrigger>
	)
}

export function getPieceReadinessTooltip(
	requirements: { fieldId: string; path: string; ready: boolean; reason?: string }[]
): string | undefined {
	if (!requirements.length) {
		return 'No media required'
	}

	return requirements
		.map((item) => {
			if (item.ready) {
				return `${item.fieldId}: ${item.path || '(empty)'}`
			}
			return `${item.fieldId}: ${item.reason ?? 'Not ready'}`
		})
		.join('\n')
}
