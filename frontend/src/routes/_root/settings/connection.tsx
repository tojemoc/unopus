import { createFileRoute } from '@tanstack/react-router'
import { Alert } from 'react-bootstrap'
import { CoreConnectionSettingsForm } from '~/components/settings/coreConnectionSettingsForm'
import { ReloadTypeManifestsButton } from '~/components/settings/reloadTypeManifestsButton'
import { ResetToDefaults } from '~/components/settings/resetToDefaultsButton'
import { useAppSelector } from '~/store/app'

export const Route = createFileRoute('/_root/settings/connection')({
	component: RouteComponent
})

function RouteComponent() {
	const settings = useAppSelector((state) => state.settings)

	return (
		<>
			<h2>Core Connection Settings</h2>

			{settings.settings && <CoreConnectionSettingsForm settings={settings.settings} />}
			{settings.error && <Alert variant="danger">{settings.error}</Alert>}

			<div className="mt-4 d-flex flex-wrap gap-2">
				<ReloadTypeManifestsButton />
				<ResetToDefaults />
			</div>
		</>
	)
}
