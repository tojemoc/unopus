import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { CoreRundownPartSettings, RundownAutoNextState } from '~backend/background/autoNextState'
import { getAutoNextStatus, type AutoNextStatus } from '~backend/background/autoNextStatus'
import { useRundownAutoNext } from './useRundownAutoNext'

const STATUS_LABELS: Record<AutoNextStatus, string> = {
	confirmed: 'AUTO confirmed in Sofie',
	pending: 'AUTO pending',
	mismatch: 'AUTO MISMATCH',
	'no-duration': 'AUTO on, but no duration: will not auto-take',
	unknown: 'AUTO unknown (Sofie unreachable / rundown not synced)'
}

interface AutoNextStatusView {
	status: AutoNextStatus
	label: string
	detail?: string
}

interface RundownAutoNextContextValue {
	state: RundownAutoNextState | null
	loading: boolean
	getPartStatus(partExternalId: string, intentOn: boolean): AutoNextStatusView
}

const RundownAutoNextContext = createContext<RundownAutoNextContextValue | null>(null)

export function RundownAutoNextProvider({
	rundownId,
	children
}: {
	rundownId: string
	children: ReactNode
}) {
	const { state, loading } = useRundownAutoNext(rundownId)
	const partsByExternalId = useMemo(
		() => new Map((state?.parts ?? []).map((part) => [part.partExternalId, part])),
		[state]
	)
	const value = useMemo<RundownAutoNextContextValue>(() => {
		return {
			state,
			loading,
			getPartStatus(partExternalId, intentOn) {
				const settings = partsByExternalId.get(partExternalId)
				const part: CoreRundownPartSettings | undefined =
					settings &&
					typeof settings.autoNext === 'boolean' &&
					settings.expectedDuration !== undefined
						? {
								partExternalId: settings.partExternalId,
								autoNext: settings.autoNext,
								expectedDuration: settings.expectedDuration,
								...(settings.autoNextSource
									? { autoNextSource: settings.autoNextSource }
									: {})
							}
						: undefined
				const status = getAutoNextStatus({
					source: state?.source ?? 'core-error',
					intentOn,
					part,
					lastIngestAt: settings?.lastIngestAt
				})
				const label =
					status === 'mismatch' && part?.autoNextSource === 'blueprint'
						? `${STATUS_LABELS[status]}: Sofie has ${part.autoNext ? 'on' : 'off'} (forced by blueprint)`
						: status === 'mismatch'
							? `${STATUS_LABELS[status]}: Sofie has ${part?.autoNext ? 'on' : 'off'}`
							: STATUS_LABELS[status]

				return {
					status,
					label,
					detail: status === 'unknown' ? state?.error : undefined
				}
			}
		}
	}, [state, loading, partsByExternalId])

	return <RundownAutoNextContext.Provider value={value}>{children}</RundownAutoNextContext.Provider>
}

export function useRundownAutoNextContext(): RundownAutoNextContextValue {
	const context = useContext(RundownAutoNextContext)
	if (!context) {
		throw new Error('useRundownAutoNextContext must be used within RundownAutoNextProvider')
	}
	return context
}
