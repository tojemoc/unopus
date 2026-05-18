export function formatDateKey(timeZone: string, instant: number = Date.now()): string {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	})
	const parts = formatter.formatToParts(new Date(instant))
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? ''
	const year = get('year')
	const month = get('month')
	const day = get('day')
	return `${year}-${month}-${day}`
}

export function formatClockTime(timeZone: string, instant: number = Date.now()): string {
	return new Intl.DateTimeFormat(undefined, {
		timeZone,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).format(new Date(instant))
}

export function rundownDateKey(
	timeZone: string,
	rundown: { scheduleDateKey?: string; expectedStartTime?: number }
): string | null {
	if (rundown.scheduleDateKey) {
		return rundown.scheduleDateKey
	}
	if (rundown.expectedStartTime) {
		return formatDateKey(timeZone, rundown.expectedStartTime)
	}
	return null
}

export function compareDateKeys(a: string, b: string): number {
	return a.localeCompare(b)
}

export const COMMON_TIMEZONES = [
	'Europe/Bratislava',
	'Europe/London',
	'Europe/Paris',
	'Europe/Berlin',
	'UTC',
	'America/New_York',
	'America/Los_Angeles'
]
