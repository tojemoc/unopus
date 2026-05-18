import { Card, Col } from 'react-bootstrap'
import { Link } from '@tanstack/react-router'
import type { Rundown } from '~backend/background/interfaces'
import { CoreConnectionStatus } from '~backend/background/interfaces'
import { useAppSelector } from '~/store/app'

function syncLabel(rundown: Rundown, coreStatus: CoreConnectionStatus): string {
	if (!rundown.sync) {
		return 'Unsynced'
	}
	if (rundown.sync && coreStatus === CoreConnectionStatus.DISCONNECTED) {
		return 'Error'
	}
	if (coreStatus === CoreConnectionStatus.CONNECTED) {
		return 'Synced'
	}
	return 'Pending'
}

function syncClass(rundown: Rundown, coreStatus: CoreConnectionStatus): string {
	const label = syncLabel(rundown, coreStatus)
	return `rundown-card__sync rundown-card__sync--${label.toLowerCase()}`
}

export interface RundownCardProps {
	rundown: Rundown
	storyCount: number
	collapsed?: boolean
	extraActions?: React.ReactNode
}

export function RundownCard({ rundown, storyCount, collapsed, extraActions }: RundownCardProps) {
	const coreStatus = useAppSelector((s) => s.coreConnectionStatus.status)

	return (
		<Col>
			<Card className={`rundown-card h-100 ${collapsed ? 'rundown-card--collapsed' : ''}`}>
				<Card.Body className="d-flex flex-column">
					<Card.Title className={collapsed ? 'h6 mb-1' : undefined}>{rundown.name}</Card.Title>
					{!collapsed && (
						<>
							<Card.Text className="text-muted small mb-2">
								{rundown.expectedStartTime
									? new Date(rundown.expectedStartTime).toLocaleString()
									: 'No scheduled time'}
							</Card.Text>
							<div className="d-flex gap-2 flex-wrap mb-3 small">
								<span className="badge bg-secondary">{storyCount} stories</span>
								<span className={syncClass(rundown, coreStatus)}>
									{syncLabel(rundown, coreStatus)}
								</span>
								{rundown.templateOutdated && (
									<span className="badge bg-warning text-dark">Outdated template</span>
								)}
								{rundown.modifiedAfterGeneration && (
									<span className="badge bg-info text-dark">Modified</span>
								)}
							</div>
						</>
					)}
					<div className="d-flex flex-wrap gap-2 mt-auto">
						<Link
							to="/rundown/$rundownId"
							params={{ rundownId: rundown.id }}
							className="btn btn-primary btn-sm align-self-start"
						>
							Open
						</Link>
						{extraActions}
					</div>
				</Card.Body>
			</Card>
		</Col>
	)
}
