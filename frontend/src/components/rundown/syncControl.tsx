import { Form, Stack } from 'react-bootstrap'
import type { Rundown } from '~backend/background/interfaces'
import { useAppDispatch } from '~/store/app'
import { updateRundown } from '~/store/rundowns'
import { SyncStatusIndicator } from './syncStatusIndicator'
import { friendlyLabel } from '~/util/fieldLabels'

export function SyncControl({ rundown, compact = false }: { rundown: Rundown; compact?: boolean }) {
	const dispatch = useAppDispatch()
	const syncLabel = friendlyLabel('sync')

	return (
		<Stack
			direction="horizontal"
			gap={compact ? 1 : 3}
			className={`align-items-center sync-control-bar${compact ? ' sync-control-bar--compact' : ' mb-3 p-2'}`}
		>
			<SyncStatusIndicator rundown={rundown} compact={compact} />
			{!rundown.isTemplate && (
				<Form.Check
					type="switch"
					id={`sync-${rundown.id}`}
					label={compact ? <span className="visually-hidden">{syncLabel}</span> : syncLabel}
					title={syncLabel}
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
