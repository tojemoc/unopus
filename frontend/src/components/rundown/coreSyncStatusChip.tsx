import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { IconCore, IconSync } from '~/components/icons/broadcastIcons'
import { useCoreDiagnostics } from '~/hooks/useCoreDiagnostics'
import { useAppSelector } from '~/store/app'
import { CoreConnectionStatus, type Rundown } from '~backend/background/interfaces'
import './coreSyncStatusChip.scss'

type ChipTone = 'ok' | 'warn' | 'error' | 'muted'

type ChipView = {
	tone: ChipTone
	label: string
	tipLines: string[]
}

function buildChipView(
	rundown: Rundown,
	coreStatus: CoreConnectionStatus,
	diagnostics: ReturnType<typeof useCoreDiagnostics>['diagnostics'],
	loading: boolean,
	error: string | null | undefined
): ChipView {
	const probe = diagnostics?.contentStatusProbe
	const traffic = probe?.trafficLight
	const syncOn = rundown.sync
	const socketDown = coreStatus === CoreConnectionStatus.DISCONNECTED
	const socketUp = coreStatus === CoreConnectionStatus.CONNECTED

	if (error) {
		if (socketDown) {
			return {
				tone: 'error',
				label: 'Core down',
				tipLines: [`Diagnostics unavailable: ${error}`]
			}
		}
		return {
			tone: 'warn',
			label: 'Core ?',
			tipLines: [`Diagnostics unavailable: ${error}`]
		}
	}

	if (loading && !diagnostics) {
		return {
			tone: 'muted',
			label: 'Core …',
			tipLines: ['Checking Core content-status reachability…']
		}
	}

	if (traffic === 'red' || (syncOn && socketDown)) {
		const tipLines = [
			probe?.summary ?? 'Could not reach Sofie Core — check connection settings'
		]
		if (syncOn && socketDown) {
			tipLines.push('Rundown sync is on, but the Core socket is disconnected.')
		}
		return { tone: 'error', label: 'Core down', tipLines }
	}

	if (traffic === 'yellow') {
		return {
			tone: 'warn',
			label: 'Core local-scan',
			tipLines: [probe?.summary ?? 'Core content-status is in local-scan mode.']
		}
	}

	if (!syncOn) {
		const tipLines = ['Sync off — changes stay local.']
		if (traffic === 'green') tipLines.push('Core content-status is reachable.')
		return { tone: 'muted', label: 'Sync off', tipLines }
	}

	if (socketUp && (traffic === 'green' || !traffic)) {
		const tipLines = ['Synced to Sofie.']
		if (probe?.summary) tipLines.push(probe.summary)
		return { tone: 'ok', label: 'Synced', tipLines }
	}

	const tipLines = ['Waiting for Sofie Core connection…']
	if (probe?.summary) tipLines.push(probe.summary)
	return { tone: 'warn', label: 'Connecting…', tipLines }
}

/**
 * Single compact header chip for Core reachability + rundown sync state
 * (replaces separate "Core unreachable" / "Core down" pills).
 */
export function CoreSyncStatusChip({ rundown }: { rundown: Rundown }) {
	const coreStatus = useAppSelector((s) => s.coreConnectionStatus.status)
	const { diagnostics, loading, error } = useCoreDiagnostics()
	const view = buildChipView(rundown, coreStatus, diagnostics, loading, error)
	const tooltipText = [
		...view.tipLines,
		diagnostics?.connection.url
			? `Core: ${diagnostics.connection.url}:${diagnostics.connection.port ?? ''}`
			: null,
		diagnostics?.contentStatusProbe?.checkedAt
			? `Checked: ${diagnostics.contentStatusProbe.checkedAt}`
			: null
	]
		.filter(Boolean)
		.join('\n')
	const Icon = view.tone === 'ok' || view.tone === 'muted' ? IconSync : IconCore

	const chip = (
		<span
			className={`core-sync-status-chip core-sync-status-chip--${view.tone}`}
			role="status"
			aria-label={tooltipText.replace(/\n/g, '. ')}
		>
			<span className="core-sync-status-chip__icon" aria-hidden>
				<Icon size={12} />
			</span>
			<span className="core-sync-status-chip__label">{view.label}</span>
		</span>
	)

	return (
		<OverlayTrigger
			placement="bottom"
			overlay={
				<Tooltip id="core-sync-status-chip">
					<span className="core-sync-status-chip-tooltip">{tooltipText}</span>
				</Tooltip>
			}
		>
			{chip}
		</OverlayTrigger>
	)
}
