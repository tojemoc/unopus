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
