import type { PayloadManifest } from '~backend/background/interfaces'

/** Positive integer max length from a payload field, or undefined when unset. */
export function resolveFieldMaxLength(field: PayloadManifest): number | undefined {
	const max = field.maxLength
	if (typeof max !== 'number' || !Number.isFinite(max) || max < 1) {
		return undefined
	}
	return Math.floor(max)
}

/** Clamp a string to the field's maxLength when configured. */
export function clampToFieldMaxLength(field: PayloadManifest, value: string): string {
	const max = resolveFieldMaxLength(field)
	if (max === undefined) {
		return value
	}
	return value.length > max ? value.slice(0, max) : value
}

/** True when value is allowed under the field's maxLength (or no limit is set). */
export function isWithinFieldMaxLength(field: PayloadManifest, value: string): boolean {
	const max = resolveFieldMaxLength(field)
	if (max === undefined) {
		return true
	}
	return value.length <= max
}

/**
 * Returns an error message when any string payload value exceeds its field maxLength
 * (including fixed option values). Undefined when the payload is valid.
 */
export function findPayloadMaxLengthViolation(
	fields: PayloadManifest[] | undefined,
	payload: Record<string, unknown> | undefined
): string | undefined {
	if (!fields?.length || !payload) {
		return undefined
	}
	for (const field of fields) {
		const raw = payload[field.id]
		if (typeof raw !== 'string') {
			continue
		}
		if (!isWithinFieldMaxLength(field, raw)) {
			const max = resolveFieldMaxLength(field)
			return `${field.label || field.id} exceeds max length (${max})`
		}
	}
	return undefined
}
