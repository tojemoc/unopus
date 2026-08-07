export const DEFAULT_DAILY_CLONE_TIMEZONE = 'Europe/Bratislava'
export const DAILY_CLONE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** UTC offset / GMT± forms that are not IANA zone identifiers. */
const UTC_OFFSET_RE = /^[+-]\d{2}(:?\d{2})?$/i
const GMT_OFFSET_RE = /^GMT[+-]\d{1,2}(:?\d{2})?$/i

export function isValidDailyCloneTime(value: string | undefined): boolean {
	if (value === undefined || value === '') return true
	return DAILY_CLONE_TIME_RE.test(value)
}

export function isValidIanaTimeZone(timeZone: string): boolean {
	if (!timeZone || typeof timeZone !== 'string') {
		return false
	}
	const trimmed = timeZone.trim()
	if (!trimmed || UTC_OFFSET_RE.test(trimmed) || GMT_OFFSET_RE.test(trimmed)) {
		return false
	}
	try {
		// Formatter throws RangeError for unknown zones (more reliable than supportedValuesOf alone).
		new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).format(new Date())
		return true
	} catch {
		return false
	}
}

export function getLocalWallClockParts(
	now: Date,
	timeZone: string
): { hours: number; minutes: number; date: string } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(now)

	const get = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((part) => part.type === type)?.value ?? ''

	const year = get('year')
	const month = get('month')
	const day = get('day')
	return {
		hours: Number(get('hour')),
		minutes: Number(get('minute')),
		date: `${year}-${month}-${day}`
	}
}

/**
 * Calendar date `YYYY-MM-DD` in the configured daily-clone timezone.
 * Do not use `toISOString().slice(0, 10)` (UTC) or local `getFullYear`/`getMonth`/`getDate`.
 */
export function getDailyGeneratedDate(
	now: Date = new Date(),
	timeZone: string = DEFAULT_DAILY_CLONE_TIMEZONE
): string {
	return getLocalWallClockParts(now, timeZone).date
}

/**
 * True when the configured `HH:mm` has already passed (or is equal) on the current
 * local calendar day in `timeZone`.
 *
 * DST spring-forward gap (e.g. 02:30 on a day that jumps 02:00→03:00): once local
 * time is at/after the first valid instant after the gap, wall-clock comparison
 * treats the trigger as already passed for that `generatedDate`.
 *
 * DST fall-back fold: fires at most once — the first wall-clock occurrence that
 * satisfies "time has passed"; the dailyGenerations PK prevents a second run.
 */
export function hasDailyCloneTimePassed(
	now: Date,
	dailyCloneTime: string,
	timeZone: string
): boolean {
	if (!DAILY_CLONE_TIME_RE.test(dailyCloneTime)) {
		return false
	}
	const [hoursStr, minutesStr] = dailyCloneTime.split(':')
	const targetMinutes = Number(hoursStr) * 60 + Number(minutesStr)
	const { hours, minutes } = getLocalWallClockParts(now, timeZone)
	const currentMinutes = hours * 60 + minutes
	return currentMinutes >= targetMinutes
}
