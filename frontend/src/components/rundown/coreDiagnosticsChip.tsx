import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useCoreDiagnostics } from '~/hooks/useCoreDiagnostics'
import './coreDiagnosticsChip.scss'

function trafficLabel(diagnostics: ReturnType<typeof useCoreDiagnostics>['diagnostics']): {
	light: 'green' | 'yellow' | 'red' | 'unknown'
	short: string
	detail: string
} {
	if (!diagnostics) {
		return {
			light: 'unknown',
			short: 'Core …',
			detail: 'Checking Core content-status reachability…'
		}
	}

	const probe = diagnostics.contentStatusProbe
	return {
		light: probe.trafficLight,
		short:
			probe.trafficLight === 'green'
				? 'Core OK'
				: probe.trafficLight === 'yellow'
					? 'Core local-scan'
					: 'Core down',
		detail: probe.summary
	}
}

/**
 * Persistent traffic-light for what `/api/core/diagnostics` actually proves:
 * Core reachability + device studio attach for the content-status API —
 * not Package Manager's own connection state.
 */
export function CoreDiagnosticsChip({ compact = false }: { compact?: boolean }) {
	const { diagnostics, loading, error } = useCoreDiagnostics()
	const { light, short, detail } = trafficLabel(diagnostics)

	const label = error ? 'Core ?' : loading && !diagnostics ? 'Core …' : short
	const tooltipText = error
		? `Diagnostics unavailable: ${error}`
		: [
				detail,
				diagnostics?.connection.url
					? `Core: ${diagnostics.connection.url}:${diagnostics.connection.port ?? ''}`
					: null,
				diagnostics?.deviceAuth.usingUnsecureToken
					? 'Device auth: using default unsecureToken'
					: diagnostics?.deviceAuth.deviceIdConfigured
						? 'Device auth: custom credentials configured'
						: null,
				diagnostics?.contentStatusProbe.checkedAt
					? `Checked: ${diagnostics.contentStatusProbe.checkedAt}`
					: null
			]
				.filter(Boolean)
				.join('\n')

	const chip = (
		<span
			className={`core-diagnostics-chip core-diagnostics-chip--${light}${compact ? ' core-diagnostics-chip--compact' : ''}`}
			role="status"
			aria-label={tooltipText.replace(/\n/g, '. ')}
		>
			<span className="core-diagnostics-chip__dot" aria-hidden="true" />
			<span className="core-diagnostics-chip__label">{label}</span>
		</span>
	)

	return (
		<OverlayTrigger
			overlay={
				<Tooltip className="core-diagnostics-chip-tooltip">
					<span className="core-diagnostics-chip-tooltip__content">{tooltipText}</span>
				</Tooltip>
			}
		>
			{chip}
		</OverlayTrigger>
	)
}
