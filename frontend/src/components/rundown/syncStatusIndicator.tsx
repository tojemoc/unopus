import { OverlayTrigger, Tooltip } from 'react-bootstrap'
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

export function SyncStatusIndicator({ rundown }: { rundown: Rundown }) {
	const coreStatus = useAppSelector((s) => s.coreConnectionStatus.status)
	const simulated = useAppSelector((s) => Boolean(s.coreConnectionStatus.simulated))
	const state = getSyncState(rundown, coreStatus)

	const labels: Record<SyncVisualState, string> = {
		synced: simulated ? 'Synced (simulated Core)' : 'Synced to Sofie',
		pending: rundown.sync
			? simulated
				? 'Waiting for simulated Core'
				: 'Waiting for Sofie connection'
			: 'Sync off — changes stay local',
		error: simulated
			? 'Simulated Core not connected'
			: 'Could not reach Sofie Core — check connection settings'
	}

	return (
		<OverlayTrigger overlay={<Tooltip>{labels[state]}</Tooltip>}>
			<div className={`sync-status-indicator sync-status-indicator--${state}`} role="status">
				<span className="sync-status-indicator__dot" />
				<span className="sync-status-indicator__label">{labels[state]}</span>
			</div>
		</OverlayTrigger>
	)
}
