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

	const badge = (
		<span
			className={`readiness-badge readiness-badge--${state}`}
			role="status"
			aria-label={labels[state]}
		>
			{labels[state]}
		</span>
	)

	if (!tooltip) {
		return badge
	}

	return <OverlayTrigger overlay={<Tooltip>{tooltip}</Tooltip>}>{badge}</OverlayTrigger>
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
