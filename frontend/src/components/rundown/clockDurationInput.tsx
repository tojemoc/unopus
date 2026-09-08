import { useEffect, useRef, useState } from 'react'
import { Form } from 'react-bootstrap'
import { formatSecondsClock, parseDurationClockInput } from '~/util/pieceDuration'

/**
 * Local draft so mm:ss[.frac] can be typed without parse-on-every-keystroke clearing the field.
 * Cleared values commit as `null` (not `undefined`) so JSON/IPC keeps the key and sqlite
 * json_patch can delete duration — `undefined` is dropped on the wire and the old value returns.
 */
export function ClockDurationInput({
	id,
	name,
	valueSeconds,
	placeholder,
	onBlur,
	onCommit,
	size = 'sm',
	style,
	'aria-label': ariaLabel
}: {
	id?: string
	name?: string
	valueSeconds: number | undefined | null
	placeholder?: string
	onBlur?: () => void
	onCommit: (seconds: number | null) => void
	size?: 'sm' | 'lg'
	style?: React.CSSProperties
	'aria-label'?: string
}) {
	const fromProp =
		typeof valueSeconds === 'number' && Number.isFinite(valueSeconds) && valueSeconds > 0
			? formatSecondsClock(valueSeconds)
			: ''
	const [draft, setDraft] = useState(fromProp)
	const focusedRef = useRef(false)

	useEffect(() => {
		if (!focusedRef.current) {
			setDraft(fromProp)
		}
	}, [fromProp])

	return (
		<Form.Control
			size={size}
			id={id}
			name={name}
			type="text"
			inputMode="text"
			placeholder={placeholder}
			style={style}
			aria-label={ariaLabel}
			value={draft}
			onFocus={() => {
				focusedRef.current = true
			}}
			onBlur={() => {
				focusedRef.current = false
				const trimmed = draft.trim()
				if (!trimmed) {
					onCommit(null)
					setDraft('')
					onBlur?.()
					return
				}
				const parsed = parseDurationClockInput(draft)
				if (typeof parsed === 'number' && parsed > 0) {
					onCommit(parsed)
					setDraft(formatSecondsClock(parsed))
				} else {
					// Invalid clock — keep the last committed display instead of clearing.
					setDraft(fromProp)
				}
				onBlur?.()
			}}
			onChange={(e) => setDraft(e.target.value)}
		/>
	)
}
