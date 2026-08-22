import { formatScriptReadingEstimate, resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { useAppSelector } from '~/store/app'
import { useMemo } from 'react'

/**
 * Live mm:ss reading-time counter for script / voiceover text fields.
 * CPS comes from the signed-in user's profile, else ApplicationSettings.scriptCps.
 */
export function ScriptReadingCounter({ text }: { text: string | undefined | null }) {
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const settingsCps = useAppSelector((s) => s.settings.settings?.scriptCps)

	const cps = useMemo(
		() => resolveEffectiveScriptCps({ userScriptCps, settingsCps }),
		[userScriptCps, settingsCps]
	)

	const estimate = formatScriptReadingEstimate(text, cps)

	return (
		<div className="script-reading-counter d-flex flex-wrap align-items-center gap-2 mt-1">
			<span className="font-monospace small text-muted" title={`${estimate.chars} characters @ ${cps} CPS`}>
				Read time: <strong className="text-body">{estimate.clock}</strong>
				<span className="ms-1">({cps} CPS)</span>
			</span>
		</div>
	)
}
