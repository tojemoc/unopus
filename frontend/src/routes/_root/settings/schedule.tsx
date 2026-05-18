import { createFileRoute } from '@tanstack/react-router'
import { Alert } from 'react-bootstrap'
import { RundownScheduleSettingsForm } from '~/components/settings/rundownScheduleSettingsForm'
import { useAppSelector } from '~/store/app'

export const Route = createFileRoute('/_root/settings/schedule')({
	component: RouteComponent
})

function RouteComponent() {
	const settings = useAppSelector((state) => state.settings)

	return (
		<>
			<h2>Rundown scheduling</h2>
			<p className="text-muted">
				Global defaults for auto-generating weekday rundowns from templates. Individual templates
				can override ahead count and start time.
			</p>
			{settings.settings && <RundownScheduleSettingsForm settings={settings.settings} />}
			{settings.error && <Alert variant="danger">{settings.error}</Alert>}
		</>
	)
}
