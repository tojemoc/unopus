export interface CoreRundownPartSettings {
	partExternalId: string
	autoNext: boolean
	expectedDuration: number | null
	autoNextSource?: 'blueprint'
}

export type CorePartSettingsResult =
	| { source: 'core'; parts: CoreRundownPartSettings[] }
	| { source: 'core-disconnected' }
	| { source: 'core-error'; error: string }

export type RundownAutoNextSource = CorePartSettingsResult['source'] | 'not-synced'

export interface RundownAutoNextPartState {
	partExternalId: string
	autoNext?: boolean
	expectedDuration?: number | null
	autoNextSource?: 'blueprint'
	lastIngestAt?: number
}

export interface RundownAutoNextState {
	rundownId: string
	source: RundownAutoNextSource
	parts: RundownAutoNextPartState[]
	checkedAt: string
	error?: string
}
