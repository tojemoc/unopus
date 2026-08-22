import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import type { EditorialStatus } from '~/util/editorialStatus'
import './editorialStatusBadge.scss'

export type { EditorialStatus }

/**
 * Editorial status chip (distinct from media R/NR).
 * - checked: editor has manually verified the story/piece
 * - skipped: marked skip and (per settings) not editor-checked
 * - unchecked: requireEditorCheckForAir and not yet checked
 */
export function EditorialStatusBadge({
	status,
	tooltip,
	compact = false
}: {
	status: EditorialStatus
	tooltip?: string
	compact?: boolean
}) {
	const labels: Record<EditorialStatus, string> = {
		checked: compact ? '✓' : 'CHECKED',
		skipped: compact ? 'SK' : 'SKIPPED',
		unchecked: compact ? '?' : 'UNCHECKED'
	}

	const ariaLabels: Record<EditorialStatus, string> = {
		checked: 'Checked by editor',
		skipped: 'Skipped',
		unchecked: 'Not checked by editor'
	}

	const badge = (
		<span
			className={`editorial-status-badge editorial-status-badge--${status}`}
			role="status"
			aria-label={ariaLabels[status]}
		>
			{labels[status]}
		</span>
	)

	if (!tooltip) {
		return badge
	}

	return (
		<OverlayTrigger
			overlay={
				<Tooltip>
					<span>{tooltip}</span>
				</Tooltip>
			}
		>
			{badge}
		</OverlayTrigger>
	)
}
