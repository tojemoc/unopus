import { useState } from 'react'
import { Button, Card, Col, Row } from 'react-bootstrap'
import { Link, useNavigate } from '@tanstack/react-router'
import { BsCalendarPlus } from 'react-icons/bs'
import type { Rundown } from '~backend/background/interfaces'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { CoreConnectionStatus } from '~backend/background/interfaces'
import { CustomDateTimePicker } from '~/components/form'
import { ipcAPI } from '~/lib/IPC'
import { pushRundown } from '~/store/rundowns'
import { useToasts } from '~/components/toasts/useToasts'
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
	showGenerateForDate?: boolean
}

export function RundownListGrouped({ rundowns, showGenerateForDate }: RundownListGroupedProps) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()
	const parts = useAppSelector((s) => s.parts.parts)
	const coreStatus = useAppSelector((s) => s.coreConnectionStatus.status)
	const [generatingId, setGeneratingId] = useState<string | null>(null)
	const [scheduledDates, setScheduledDates] = useState<Record<string, number | null>>({})

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
											<div className="d-flex flex-wrap gap-2 mt-auto">
												<Link
													to="/rundown/$rundownId"
													params={{ rundownId: rundown.id }}
													className="btn btn-primary align-self-start"
												>
													Open
												</Link>
												{showGenerateForDate && (
													<>
														{generatingId === rundown.id ? (
															<div className="d-flex flex-wrap align-items-center gap-2">
																<CustomDateTimePicker
																	selected={
																		scheduledDates[rundown.id]
																			? new Date(scheduledDates[rundown.id]!)
																			: new Date()
																	}
																	onChange={(date) =>
																		setScheduledDates((prev) => ({
																			...prev,
																			[rundown.id]: date?.getTime() ?? null
																		}))
																	}
																	showTimeSelect={false}
																	dateFormat="yyyy-MM-dd"
																	className="form-control-sm"
																/>
																<Button
																	size="sm"
																	variant="success"
																	disabled={!scheduledDates[rundown.id]}
																	onClick={async () => {
																		const scheduledDate = scheduledDates[rundown.id]
																		if (!scheduledDate) return
																		try {
																			const newRundown =
																				await ipcAPI.generateRundownFromTemplate({
																					templateRundownId: rundown.id,
																					scheduledDate
																				})
																			dispatch(pushRundown(newRundown))
																			setGeneratingId(null)
																			await navigate({
																				to: `/rundown/${newRundown.id}`
																			})
																		} catch (e) {
																			console.error(e)
																			toasts.show({
																				headerContent: 'Generate rundown',
																				bodyContent:
																					e instanceof Error
																						? e.message
																						: 'Generation failed'
																			})
																		}
																	}}
																>
																	Confirm
																</Button>
																<Button
																	size="sm"
																	variant="secondary"
																	onClick={() => setGeneratingId(null)}
																>
																	Cancel
																</Button>
															</div>
														) : (
															<Button
																size="sm"
																variant="outline-primary"
																className="d-inline-flex align-items-center gap-1"
																onClick={() => {
																	setGeneratingId(rundown.id)
																	setScheduledDates((prev) => ({
																		...prev,
																		[rundown.id]: startOfDay(new Date())
																	}))
																}}
															>
																<BsCalendarPlus aria-hidden />
																Generate for date
															</Button>
														)}
													</>
												)}
											</div>
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
