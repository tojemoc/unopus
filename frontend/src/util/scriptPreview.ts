const DEFAULT_MAX_CHARS = 160

/** One-line excerpt for collapsed story rows so prompter copy stays visible. */
export function firstScriptLine(script: string | undefined | null, maxChars = DEFAULT_MAX_CHARS): string {
	const text = (script ?? '').replace(/\s+/g, ' ').trim()
	if (!text) return ''
	if (maxChars <= 0) return ''
	if (maxChars === 1) return '…'
	if (text.length <= maxChars) return text
	return `${text.slice(0, maxChars - 1).trimEnd()}…`
}
