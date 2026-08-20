/** Cut point within the wipe stinger when screen is fully covered (frame 38 @ 50fps). */
export const WIPE_CUT_POINT_SECONDS = 760 / 1000

/** Sub-minute durations without rounding hundredths away (e.g. 0.76s, not 0.8s). */
export function formatSecondsPrecise(seconds: number, maxDecimals = 2): string {
	const text = seconds.toFixed(maxDecimals).replace(/\.?0+$/, '')
	return `${text}s`
}
