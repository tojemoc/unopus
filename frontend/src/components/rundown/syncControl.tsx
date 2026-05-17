import { Form, Stack } from 'react-bootstrap'
import type { Rundown } from '~backend/background/interfaces'
import { useAppDispatch } from '~/store/app'
import { updateRundown } from '~/store/rundowns'
import { SyncStatusIndicator } from './syncStatusIndicator'
import { friendlyLabel } from '~/util/fieldLabels'

export function SyncControl({ rundown }: { rundown: Rundown }) {
	const dispatch = useAppDispatch()

	return (
		<Stack direction="horizontal" gap={3} className="align-items-center mb-3 p-2 sync-control-bar">
			<SyncStatusIndicator rundown={rundown} />
			{!rundown.isTemplate && (
				<Form.Check
					type="switch"
					id={`sync-${rundown.id}`}
					label={friendlyLabel('sync')}
					checked={rundown.sync}
					onChange={(e) =>
						void dispatch(
							updateRundown({
								rundown: { ...rundown, sync: e.target.checked }
							})
						)
					}
				/>
			)}
		</Stack>
	)
}
