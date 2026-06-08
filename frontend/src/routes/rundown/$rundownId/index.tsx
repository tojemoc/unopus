import { createFileRoute, redirect } from '@tanstack/react-router'
import { Stack } from 'react-bootstrap'
import { RundownPropertiesForm } from '~/components/rundown/rundownPropertiesForm'
import { SyncControl } from '~/components/rundown/syncControl'
import { useAppSelector } from '~/store/app'

export const Route = createFileRoute('/rundown/$rundownId/')({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId } = Route.useParams()

	const rundown = useAppSelector((state) => state.rundowns.find((r) => r.id === rundownId))
	if (!rundown) throw redirect({ to: '/' })

	return (
		<Stack className="rundown-main-content h-100">
			<div className="rundown-main-content-scroll p-4">
				<SyncControl rundown={rundown} />
				<RundownPropertiesForm rundown={rundown} />
			</div>
		</Stack>
	)
}
