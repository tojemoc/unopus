import { Form } from 'react-bootstrap'
import {
	formatScriptReadingEstimate,
	resolveEffectiveScriptCps,
	writeUserScriptCps
} from '~/util/scriptReadingTime'
import { useAppSelector } from '~/store/app'
import { useMemo, useState } from 'react'

/**
 * Live mm:ss reading-time counter for script / voiceover text fields.
 * CPS comes from per-user localStorage override, else ApplicationSettings.scriptCps.
 */
export function ScriptReadingCounter({
	text,
	showCpsControl = false
}: {
	text: string | undefined | null
	showCpsControl?: boolean
}) {
	const userId = useAppSelector((s) => s.auth.user?.id)
	const settingsCps = useAppSelector((s) => s.settings.settings?.scriptCps)
	const [cpsTick, setCpsTick] = useState(0)

	const cps = useMemo(() => {
		void cpsTick
		return resolveEffectiveScriptCps({ userId, settingsCps })
	}, [userId, settingsCps, cpsTick])

	const estimate = formatScriptReadingEstimate(text, cps)

	return (
		<div className="script-reading-counter d-flex flex-wrap align-items-center gap-2 mt-1">
			<span className="font-monospace small text-muted" title={`${estimate.chars} characters @ ${cps} CPS`}>
				Read time: <strong className="text-body">{estimate.clock}</strong>
				<span className="ms-1">({cps} CPS)</span>
			</span>
			{showCpsControl && userId ? (
				<Form.Control
					type="number"
					min={5}
					max={40}
					step={1}
					size="sm"
					style={{ width: '4.5rem' }}
					value={cps}
					aria-label="Your characters per second"
					title="Your CPS (saved in this browser)"
					onChange={(e) => {
						const next = Number(e.target.value)
						if (!Number.isFinite(next)) return
						writeUserScriptCps(userId, next)
						setCpsTick((t) => t + 1)
					}}
				/>
			) : null}
		</div>
	)
}
