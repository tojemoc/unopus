import type { ApplicationSettings } from './interfaces'

const SCHEDULE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isValidTimeZone(timeZone: string): boolean {
	try {
		Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
		return true
	} catch (e) {
		console.warn('Timezone validation failed', { timeZone, e })
		return false
	}
}

function validateNonNegativeInt(
	value: unknown,
	fieldName: string
): { ok: true; value: number } | { ok: false; error: string } {
	if (value === undefined || value === null) {
		return { ok: true, value: 0 }
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		return { ok: false, error: `${fieldName} must be a non-negative integer` }
	}
	return { ok: true, value }
}

function validatePositiveInt(
	value: unknown,
	fieldName: string
): { ok: true; value: number } | { ok: false; error: string } {
	if (value === undefined || value === null) {
		return { ok: false, error: `${fieldName} must be a positive integer` }
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
		return { ok: false, error: `${fieldName} must be a positive integer` }
	}
	return { ok: true, value }
}

/** Validates schedule-related ApplicationSettings fields present in payload. */
export function validateApplicationSettingsFields(
	payload: ApplicationSettings
): { ok: true; sanitized: ApplicationSettings } | { ok: false; error: string } {
	const sanitized: ApplicationSettings = { ...payload }

	if (payload.timezone !== undefined) {
		const tz = String(payload.timezone).trim()
		if (!tz || !isValidTimeZone(tz)) {
			return { ok: false, error: `Invalid timezone: ${payload.timezone}` }
		}
		sanitized.timezone = tz
	}

	if (payload.scheduleStartTime !== undefined) {
		const t = String(payload.scheduleStartTime).trim()
		if (!SCHEDULE_TIME_RE.test(t)) {
			return {
				ok: false,
				error: 'scheduleStartTime must be HH:mm in 24-hour notation (e.g. 18:00)'
			}
		}
		sanitized.scheduleStartTime = t
	}

	if (payload.scheduleAheadCount !== undefined) {
		const ahead = validatePositiveInt(payload.scheduleAheadCount, 'scheduleAheadCount')
		if (!ahead.ok) {
			return { ok: false, error: ahead.error }
		}
		sanitized.scheduleAheadCount = ahead.value
	}

	if (payload.rundownListPastVisible !== undefined) {
		const past = validateNonNegativeInt(
			payload.rundownListPastVisible,
			'rundownListPastVisible'
		)
		if (!past.ok) {
			return { ok: false, error: past.error }
		}
		sanitized.rundownListPastVisible = past.value
	}

	if (payload.rundownListFutureVisible !== undefined) {
		const future = validateNonNegativeInt(
			payload.rundownListFutureVisible,
			'rundownListFutureVisible'
		)
		if (!future.ok) {
			return { ok: false, error: future.error }
		}
		sanitized.rundownListFutureVisible = future.value
	}

	return { ok: true, sanitized }
}
