/**
 * Map Core / Meteor exception text to short operator-facing labels.
 * Never return the raw Core string — messages can include device ids and internal paths.
 */
export function toSafeCoreOperatorLabel(error: unknown): string {
	const message = (error instanceof Error ? error.message : String(error)).toLowerCase()

	if (
		message.includes('no studio') ||
		message.includes('not assigned to a studio') ||
		message.includes('device has no studio') ||
		(message.includes('studio') && message.includes('not set'))
	) {
		return 'Device has no studio'
	}

	if (
		message.includes('unauthorized') ||
		message.includes('not authorized') ||
		message.includes('access denied') ||
		message.includes('not allowed')
	) {
		return 'Unauthorized'
	}

	if (
		message.includes('method not found') ||
		message.includes('unknown method') ||
		message.includes('does not exist') ||
		message.includes('is not a function') ||
		message.includes('unavailable')
	) {
		return 'Core method unavailable'
	}

	return 'Core content-status call failed'
}
