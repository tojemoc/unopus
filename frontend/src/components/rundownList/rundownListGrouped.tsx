import { Card, Col, Row } from 'react-bootstrap'
import { Link } from '@tanstack/react-router'
import type { Rundown } from '~backend/background/interfaces'
import { useAppSelector } from '~/store/app'
import { CoreConnectionStatus } from '~backend/background/interfaces'
import './rundownListGrouped.scss'

function startOfDay(date: Date): number {
	const d = new Date(date)
	d.setHours(0, 0, 0, 0)
	return d.getTime()
}

function formatDateLabel(timestamp: number | undefined): string {
	if (!timestamp) {
		return 'No date set'
	}
	const day = startOfDay(new Date(timestamp))
	const today = startOfDay(new Date())
	if (day === today) {
		return 'Today'
	}
	const yesterday = today - 86400000
	if (day === yesterday) {
		return 'Yesterday'
	}
	return new Date(timestamp).toLocaleDateString(undefined, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	})
}

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

interface RundownListGroupedProps {
	rundowns: Rundown[]
}

export function RundownListGrouped({ rundowns }: RundownListGroupedProps) {
	const parts = useAppSelector((s) => s.parts.parts)
	const coreStatus = useAppSelector((s) => s.coreConnectionStatus.status)

	if (rundowns.length === 0) {
		return (
			<div className="rundown-empty-state">
				<p>No rundowns yet. Create one to get started.</p>
			</div>
		)
	}

	const groups = new Map<string, { label: string; sortKey: number; rundowns: Rundown[] }>()

	for (const rundown of rundowns) {
		const keyTime = rundown.expectedStartTime ?? 0
		const label = formatDateLabel(rundown.expectedStartTime)
		const groupKey = rundown.expectedStartTime
			? String(startOfDay(new Date(rundown.expectedStartTime)))
			: 'undated'
		const existing = groups.get(groupKey)
		if (existing) {
			existing.rundowns.push(rundown)
		} else {
			groups.set(groupKey, {
				label,
				sortKey: groupKey === 'undated' ? -1 : keyTime,
				rundowns: [rundown]
			})
		}
	}

	const sortedGroups = [...groups.values()].sort((a, b) => {
		if (a.sortKey === -1) {
			return 1
		}
		if (b.sortKey === -1) {
			return -1
		}
		return b.sortKey - a.sortKey
	})

	// Pin today to top
	sortedGroups.sort((a, b) => {
		const aToday = a.label === 'Today'
		const bToday = b.label === 'Today'
		if (aToday && !bToday) {
			return -1
		}
		if (bToday && !aToday) {
			return 1
		}
		return 0
	})

	return (
		<div className="rundown-list-grouped">
			{sortedGroups.map((group) => (
				<section key={group.label} className="mb-4">
					<h2 className="h5 text-muted mb-3">{group.label}</h2>
					<Row xs={1} md={2} lg={3} className="g-3">
						{group.rundowns.map((rundown) => {
							const storyCount = parts.filter((p) => p.rundownId === rundown.id).length
							return (
								<Col key={rundown.id}>
									<Card className="rundown-card h-100">
										<Card.Body className="d-flex flex-column">
											<Card.Title>{rundown.name}</Card.Title>
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
											</div>
											<Link
												to="/rundown/$rundownId"
												params={{ rundownId: rundown.id }}
												className="btn btn-primary mt-auto align-self-start"
											>
												Open
											</Link>
										</Card.Body>
									</Card>
								</Col>
							)
						})}
					</Row>
				</section>
			))}
		</div>
	)
}
