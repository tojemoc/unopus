export const DEFAULT_DAILY_CLONE_TIMEZONE = 'Europe/Bratislava'
export const DAILY_CLONE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** UTC offset / GMT± forms that are not IANA zone identifiers. */
const UTC_OFFSET_RE = /^[+-]\d{2}(:?\d{2})?$/i
const GMT_OFFSET_RE = /^GMT[+-]\d{1,2}(:?\d{2})?$/i

/**
 * Validates if a string is a valid daily clone time in HH:mm format.
 * @param value - The time string to validate.
 * @returns True if valid or undefined/empty, false otherwise.
 */
export function isValidDailyCloneTime(value: string | undefined): boolean {
	if (value === undefined || value === '') return true
	return DAILY_CLONE_TIME_RE.test(value)
}

/**
 * Validates if a string is a valid IANA timezone identifier.
 * Rejects UTC offset and GMT offset formats.
 * @param timeZone - The timezone string to validate.
 * @returns True if valid IANA timezone, false otherwise.
 */
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

/**
 * Gets the local wall clock time components (hours, minutes, date) for a given date in a specific timezone.
 * @param now - The date to convert.
 * @param timeZone - The IANA timezone identifier.
 * @returns An object with hours, minutes, and date (YYYY-MM-DD) in the specified timezone.
 */
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

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Returns the timestamp for `targetDate` (YYYY-MM-DD) at `timestamp`'s wall-clock
 * time-of-day in `timeZone` (server-local when omitted). A naive +N-days shift
 * would land the wrong wall-clock time across a DST boundary, so the instant is
 * rebuilt from the target date + extracted time-of-day instead.
 */
export function retimeTimestampToDate(
	timestamp: number,
	targetDate: string,
	timeZone?: string
): number {
	const source = new Date(timestamp)
	let hours: number, minutes: number, seconds: number
	if (timeZone) {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).formatToParts(source)
		const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
		hours = get('hour')
		minutes = get('minute')
		seconds = get('second')
	} else {
		hours = source.getHours()
		minutes = source.getMinutes()
		seconds = source.getSeconds()
	}
	const ms = source.getMilliseconds()

	if (!timeZone) {
		const [y, mo, d] = targetDate.split('-').map(Number)
		return new Date(y, mo - 1, d, hours, minutes, seconds, ms).getTime()
	}

	// Interpret the target date+time as UTC first, then subtract the zone's
	// offset measured at that instant.
	const naiveUtc = Date.parse(
		`${targetDate}T${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${String(ms).padStart(3, '0')}Z`
	)
	const zoneParts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(naiveUtc))
	const get = (type: string) => Number(zoneParts.find((p) => p.type === type)?.value ?? '0')
	const wallAsUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second')
	)
	const zoneOffsetMs = (ts: number): number => {
		const zp = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		}).formatToParts(new Date(ts))
		const g = (type: string) => Number(zp.find((p) => p.type === type)?.value ?? '0')
		return (
			Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) -
			Math.floor(ts / 1000) * 1000
		)
	}

	// Second pass: the first guess may sit on the other side of a DST transition
	// from naiveUtc, so remeasure the offset at the guess before returning.
	const offsetMs = wallAsUtc - Math.floor(naiveUtc / 1000) * 1000
	let result = naiveUtc - offsetMs
	const refinedOffset = zoneOffsetMs(result)
	if (refinedOffset !== offsetMs) result = naiveUtc - refinedOffset
	return result
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
