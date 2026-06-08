import { useForm } from '@tanstack/react-form'
import { Button, Form } from 'react-bootstrap'
import type { ApplicationSettings } from '~backend/background/interfaces'
import { COMMON_TIMEZONES } from '~/util/timezone'
import { useAppDispatch } from '~/store/app'
import { updateSettings } from '~/store/settings'
import { useToasts } from '../toasts/useToasts'

export function RundownScheduleSettingsForm({ settings }: { settings: ApplicationSettings }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	const form = useForm({
		defaultValues: {
			timezone: settings.timezone ?? 'Europe/Bratislava',
			scheduleAheadCount: settings.scheduleAheadCount ?? 5,
			scheduleStartTime: settings.scheduleStartTime ?? '18:00',
			rundownListPastVisible: settings.rundownListPastVisible ?? 2,
			rundownListFutureVisible: settings.rundownListFutureVisible ?? 4
		},
		onSubmit: async (values) => {
			const raw = values.value
			const scheduleAheadCount = Math.min(
				30,
				Math.max(1, Math.round(Number(raw.scheduleAheadCount) || 5))
			)
			const rundownListPastVisible = Math.min(
				14,
				Math.max(0, Math.round(Number(raw.rundownListPastVisible) || 0))
			)
			const rundownListFutureVisible = Math.min(
				14,
				Math.max(0, Math.round(Number(raw.rundownListFutureVisible) || 0))
			)
			const scheduleStartTime = String(raw.scheduleStartTime ?? '').trim()
			if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(scheduleStartTime)) {
				toasts.show({
					headerContent: 'Schedule settings',
					bodyContent: 'Start time must be HH:mm in 24-hour notation (e.g. 18:00)'
				})
				return
			}

			try {
				await dispatch(
					updateSettings({
						settings: {
							...settings,
							timezone: raw.timezone,
							scheduleAheadCount,
							scheduleStartTime,
							rundownListPastVisible,
							rundownListFutureVisible
						}
					})
				).unwrap()
				toasts.show({
					headerContent: 'Schedule settings',
					bodyContent: 'Saved'
				})
				form.reset()
			} catch (e) {
				console.error(e)
				toasts.show({
					headerContent: 'Schedule settings',
					bodyContent: 'Could not save settings'
				})
			}
		}
	})

	return (
		<Form
			onSubmit={(e) => {
				e.preventDefault()
				form.handleSubmit()
			}}
		>
			<form.Field name="timezone">
				{(field) => (
					<Form.Group className="mb-3">
						<Form.Label>Timezone</Form.Label>
						<Form.Select
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
						>
							{COMMON_TIMEZONES.map((tz) => (
								<option key={tz} value={tz}>
									{tz}
								</option>
							))}
						</Form.Select>
						<Form.Text className="text-muted">
							Used for weekday scheduling, rundown grouping, and the header clock.
						</Form.Text>
					</Form.Group>
				)}
			</form.Field>

			<form.Field name="scheduleAheadCount">
				{(field) => (
					<Form.Group className="mb-3">
						<Form.Label>Weekday rundowns to schedule ahead (default)</Form.Label>
						<Form.Control
							type="number"
							min={1}
							max={30}
							value={field.state.value}
							onChange={(e) => field.handleChange(Number(e.target.value))}
						/>
					</Form.Group>
				)}
			</form.Field>

			<form.Field name="scheduleStartTime">
				{(field) => (
					<Form.Group className="mb-3">
						<Form.Label>Default expected start time (24h)</Form.Label>
						<Form.Control
							type="time"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
						/>
					</Form.Group>
				)}
			</form.Field>

			<form.Field name="rundownListPastVisible">
				{(field) => (
					<Form.Group className="mb-3">
						<Form.Label>Past rundowns shown expanded on home</Form.Label>
						<Form.Control
							type="number"
							min={0}
							max={14}
							value={field.state.value}
							onChange={(e) => field.handleChange(Number(e.target.value))}
						/>
					</Form.Group>
				)}
			</form.Field>

			<form.Field name="rundownListFutureVisible">
				{(field) => (
					<Form.Group className="mb-3">
						<Form.Label>Future rundowns shown expanded on home (after today)</Form.Label>
						<Form.Control
							type="number"
							min={0}
							max={14}
							value={field.state.value}
							onChange={(e) => field.handleChange(Number(e.target.value))}
						/>
					</Form.Group>
				)}
			</form.Field>

			<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting, s.isPristine]}>
				{([canSubmit, isSubmitting, isPristine]) => (
					<Button type="submit" disabled={!canSubmit || isSubmitting || isPristine}>
						{isSubmitting ? 'Saving…' : 'Save'}
					</Button>
				)}
			</form.Subscribe>
		</Form>
	)
}
