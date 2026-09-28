import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { IconSync } from '~/components/icons/broadcastIcons'
import { useAppSelector } from '~/store/app'
import { CoreConnectionStatus, type Rundown } from '~backend/background/interfaces'
import './syncStatusIndicator.scss'

type SyncVisualState = 'synced' | 'pending' | 'error'

function getSyncState(rundown: Rundown, coreStatus: CoreConnectionStatus): SyncVisualState {
	if (!rundown.sync) {
		return 'pending'
	}
	if (rundown.sync && coreStatus === CoreConnectionStatus.DISCONNECTED) {
		return 'error'
	}
	if (coreStatus === CoreConnectionStatus.CONNECTED) {
		return 'synced'
	}
	return 'pending'
}

export function SyncStatusIndicator({
	rundown,
	compact = false
}: {
	rundown: Rundown
	compact?: boolean
}) {
	const coreStatus = useAppSelector((s) => s.coreConnectionStatus.status)
	const state = getSyncState(rundown, coreStatus)

	const detailLabels: Record<SyncVisualState, string> = {
		synced: 'Synced to Sofie',
		pending: rundown.sync ? 'Waiting for Sofie connection' : 'Sync off — changes stay local',
		error: 'Could not reach Sofie Core — check connection settings'
	}
	const shortLabels: Record<SyncVisualState, string> = {
		synced: 'Synced',
		pending: rundown.sync ? 'Connecting…' : 'Sync off',
		error: 'Core unreachable'
	}
	const label = compact ? shortLabels[state] : detailLabels[state]

	return (
		<OverlayTrigger
			placement="bottom"
			overlay={<Tooltip id={`sync-status-${state}`}>{detailLabels[state]}</Tooltip>}
		>
			<div
				className={`sync-status-indicator sync-status-indicator--${state}${compact ? ' sync-status-indicator--compact' : ''}`}
				role="status"
			>
				<span className="sync-status-indicator__icon" aria-hidden>
					<IconSync size={12} />
				</span>
				<span className="sync-status-indicator__label">{label}</span>
			</div>
		</OverlayTrigger>
	)
}
