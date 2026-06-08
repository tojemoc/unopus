const WEEKDAY_SHORT: Record<string, number> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6
}

const DEFAULT_TIME_ZONE = 'UTC'
const MAX_ZONED_TO_UTC_ITERATIONS = 128

export interface ZonedDateTime {
	year: number
	month: number
	day: number
	hour: number
	minute: number
	weekday: number
}

function formatZonedDateTime(timeZone: string, instant: number): ZonedDateTime {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		weekday: 'short'
	})
	const parts = formatter.formatToParts(new Date(instant))
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? ''

	const weekdayShort = get('weekday')
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: Number(get('hour')),
		minute: Number(get('minute')),
		weekday: WEEKDAY_SHORT[weekdayShort] ?? 0
	}
}

export function getZonedDateTime(timeZone: string, instant: number = Date.now()): ZonedDateTime {
	try {
		return formatZonedDateTime(timeZone, instant)
	} catch (err) {
		if (err instanceof RangeError) {
			console.warn(`Invalid timezone "${timeZone}", falling back to ${DEFAULT_TIME_ZONE}`)
			return formatZonedDateTime(DEFAULT_TIME_ZONE, instant)
		}
		throw err
	}
}

export function formatDateKey(timeZone: string, instant: number = Date.now()): string {
	const z = getZonedDateTime(timeZone, instant)
	return `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`
}

export function parseTimeHHmm(value: string): { hour: number; minute: number } {
	const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
	if (!match) {
		return { hour: 18, minute: 0 }
	}
	const hour = Math.min(23, Math.max(0, Number(match[1])))
	const minute = Math.min(59, Math.max(0, Number(match[2])))
	return { hour, minute }
}

export function zonedDateTimeToUtc(
	timeZone: string,
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number
): number {
	let t = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
	let lastDelta = Infinity

	for (let i = 0; i < MAX_ZONED_TO_UTC_ITERATIONS; i++) {
		const z = getZonedDateTime(timeZone, t)
		if (
			z.year === year &&
			z.month === month &&
			z.day === day &&
			z.hour === hour &&
			z.minute === minute
		) {
			return t
		}
		const targetMinutes = hour * 60 + minute
		const actualMinutes = z.hour * 60 + z.minute
		const dayDelta = (year - z.year) * 400 + (month - z.month) * 31 + (day - z.day)
		const deltaMs = (dayDelta * 24 * 60 + (targetMinutes - actualMinutes)) * 60 * 1000
		if (Math.abs(deltaMs) < 1) {
			return t
		}
		if (Math.abs(deltaMs) >= Math.abs(lastDelta)) {
			break
		}
		lastDelta = deltaMs
		t += deltaMs
	}

	throw new Error(
		`zonedDateTimeToUtc failed to converge for ${timeZone} ${year}-${month}-${day} ${hour}:${minute}`
	)
}

export function addCalendarDays(
	year: number,
	month: number,
	day: number,
	deltaDays: number
): { year: number; month: number; day: number } {
	const d = new Date(Date.UTC(year, month - 1, day + deltaDays))
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate()
	}
}

export function isWeekday(weekday: number): boolean {
	return weekday >= 1 && weekday <= 5
}

function advanceWeekday(weekday: number): number {
	return weekday === 6 ? 0 : weekday + 1
}

/** Next `count` weekdays starting from today if weekday, else from next weekday. */
export function getSchedulingDateKeys(timeZone: string, count: number, now = Date.now()): string[] {
	const keys: string[] = []
	let { year, month, day, weekday } = getZonedDateTime(timeZone, now)

	if (!isWeekday(weekday)) {
		const cursor = addCalendarDays(year, month, day, 1)
		year = cursor.year
		month = cursor.month
		day = cursor.day
		weekday = advanceWeekday(weekday)
		while (!isWeekday(weekday)) {
			const next = addCalendarDays(year, month, day, 1)
			year = next.year
			month = next.month
			day = next.day
			weekday = advanceWeekday(weekday)
		}
	}

	while (keys.length < count) {
		if (isWeekday(weekday)) {
			keys.push(
				`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
			)
		}
		const next = addCalendarDays(year, month, day, 1)
		year = next.year
		month = next.month
		day = next.day
		weekday = advanceWeekday(weekday)
	}

	return keys
}

export function scheduledStartMs(
	timeZone: string,
	dateKey: string,
	timeHHmm: string
): number {
	const [y, m, d] = dateKey.split('-').map(Number)
	const { hour, minute } = parseTimeHHmm(timeHHmm)
	return zonedDateTimeToUtc(timeZone, y, m, d, hour, minute)
}

export function compareDateKeys(a: string, b: string): number {
	return a.localeCompare(b)
}

export function getTodayDateKey(timeZone: string, now = Date.now()): string {
	return formatDateKey(timeZone, now)
}
