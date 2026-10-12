import { FORCED_AUTO_NEXT_TOOLTIP } from '~backend/background/forcedAutoNext'

/** "AUTO" badge for parts whose type/pieces force autoNext in Sofie (manifest-driven). */
export function ForcedAutoBadge({ missingDuration }: { missingDuration: boolean }) {
	const text = missingDuration
		? `${FORCED_AUTO_NEXT_TOOLTIP}. Warning: no duration set, so Sofie cannot auto-take this part.`
		: FORCED_AUTO_NEXT_TOOLTIP
	return (
		<span
			className={`forced-auto-badge${missingDuration ? ' forced-auto-badge--warning' : ''}`}
			tabIndex={0}
			title={text}
			aria-label={`AUTO forced by Sofie. ${text}`}
		>
			AUTO{missingDuration ? ' ⚠' : ''}
		</span>
	)
}
