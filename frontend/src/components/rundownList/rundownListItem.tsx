import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { Button, ListGroup, Stack, type ButtonProps } from 'react-bootstrap'
import { useAppDispatch } from '~/store/app'
import { copyRundown } from '~/store/rundowns'
import type { Rundown } from '~backend/background/interfaces'
import { SyncButton } from './syncButton'
import { HoverIconButton } from './hoverIconButton'
import { BsArrowRightShort, BsCopy, BsFillTrashFill, BsTrash } from 'react-icons/bs'
import { DeleteRundownButton } from '../rundown/deleteRundownButton'
import { useToasts } from '../toasts/useToasts'
import { fetchDailyGenerationStatus, type TemplateDailyStatus } from '~/lib/dailyGenerationApi'
import { useGenerateDailyRundown } from '~/hooks/useGenerateDailyRundown'

export function RundownListItem({
	rundown,
	dailyStatus
}: {
	rundown: Rundown
	dailyStatus?: TemplateDailyStatus
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()
	const [status, setStatus] = useState<TemplateDailyStatus | undefined>(dailyStatus)

	useEffect(() => {
		setStatus(dailyStatus)
	}, [dailyStatus])

	const refreshStatus = useCallback(async () => {
		if (!rundown.isTemplate) return
		try {
			const next = await fetchDailyGenerationStatus(rundown.id)
			setStatus({ ...next, templateId: rundown.id })
		} catch (error) {
			console.error(error)
		}
	}, [rundown.id, rundown.isTemplate])

	const { generate, isGenerating } = useGenerateDailyRundown(refreshStatus)

	const handleCopyRundown = (sourceRundown: Rundown, preserveTemplate: boolean = false) => {
		dispatch(
			copyRundown({
				id: sourceRundown.id,
				preserveTemplate
			})
		)
			.unwrap()
			.then(async (newRundownResult) => {
				await navigate({
					to: `/rundown/${newRundownResult.id}`
				})
			})
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Adding rundown',
					bodyContent: 'Encountered an unexpected error'
				})
			})
	}

	const handleGenerateNow = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		void generate(rundown.id)
	}

	const handleClick = (e: React.MouseEvent) => {
		if (e.defaultPrevented) return
		navigate({ to: `/rundown/${rundown.id}` })
	}

	const generatedToday =
		status?.status === 'completed' && status.rundownId
			? { id: status.rundownId, name: status.rundownName }
			: null

	return (
		<ListGroup.Item action onClick={handleClick} className="copy-item">
			<Stack direction="horizontal" className="align-items-baseline">
				<div style={{ position: 'relative', left: '-.35em', top: '.1em', width: '24px' }}>
					{!rundown.isTemplate ? <SyncButton rundown={rundown} /> : null}
				</div>
				<div className="flex-grow-1">
					<div>{rundown.name}</div>
					{rundown.isTemplate && (
						<div className="small text-muted mt-1" onClick={(e) => e.stopPropagation()}>
							{generatedToday ? (
								<>
									Generated today ·{' '}
									<Link
										to="/rundown/$rundownId"
										params={{ rundownId: generatedToday.id }}
										onClick={(e) => e.stopPropagation()}
									>
										{generatedToday.name ?? generatedToday.id}
									</Link>
								</>
							) : (
								<span>Not generated today</span>
							)}
							{rundown.isTemplate && (
								<Button
									size="sm"
									variant="outline-secondary"
									className="ms-2"
									disabled={isGenerating(rundown.id)}
									onClick={(e) => handleGenerateNow(e)}
								>
									{isGenerating(rundown.id) ? 'Generating…' : 'Generate now'}
								</Button>
							)}
						</div>
					)}
				</div>
				<Stack direction="horizontal" className="ms-auto" gap={1} style={{ opacity: 0.7 }}>
					{rundown.isTemplate || (!rundown.expectedStartTime && !rundown.expectedEndTime) ? null : (
						<>
							<span
								className="ms-1"
								style={{
									fontSize: '.7em',
									width: '129px',
									fontFamily: 'monospace',
									textAlign: 'center'
								}}
							>
								{rundown.expectedStartTime ? (
									new Date(rundown.expectedStartTime).toLocaleString('sv-SE').replace('T', '')
								) : (
									<span style={{ opacity: 0.4 }}>no start selected</span>
								)}
							</span>
							<BsArrowRightShort />
							<span
								style={{
									fontSize: '.7em',
									width: '129px',
									fontFamily: 'monospace',
									textAlign: 'center'
								}}
							>
								{rundown.expectedEndTime ? (
									new Date(rundown.expectedEndTime).toLocaleString('sv-SE').replace('T', ' ')
								) : (
									<span style={{ opacity: 0.4 }}>no end selected</span>
								)}
							</span>
						</>
					)}
				</Stack>
				<Stack className="ms-2" direction="horizontal" gap={1}>
					<DeleteRundownButton
						rundownId={rundown.id}
						rundownName={rundown.name}
						disabled={false}
						style={{ zIndex: 4 }}
						renderButton={({ onClick, disabled }: ButtonProps) => (
							<HoverIconButton
								onClick={onClick}
								disabled={disabled}
								className="sync-plus-wrapper ms-auto"
								defaultIcon={<BsTrash className="icon-md" color="var(--bs-danger)" />}
								hoverIcon={<BsFillTrashFill className="icon-md" color="var(--bs-danger)" />}
							/>
						)}
					/>

					<HoverIconButton
						className="sync-plus-wrapper ms-auto"
						defaultIcon={
							<BsCopy
								className="icon-md text-primary"
								style={{ fontSize: '1em', opacity: '75%' }}
							/>
						}
						hoverIcon={<BsCopy className="icon-md text-primary" style={{ fontSize: '1em' }} />}
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							handleCopyRundown(rundown, rundown.isTemplate)
						}}
					/>
				</Stack>
			</Stack>
		</ListGroup.Item>
	)
}
