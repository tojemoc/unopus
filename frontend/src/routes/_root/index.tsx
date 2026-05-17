import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { Button, Dropdown, SplitButton, Stack, Tab, Tabs } from 'react-bootstrap'
import { BsBoxArrowInUp, BsPlus } from 'react-icons/bs'
import { RundownListGrouped } from '~/components/rundownList/rundownListGrouped'
import { useToasts } from '~/components/toasts/useToasts'
import { ipcAPI } from '~/lib/IPC'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { addNewRundown, copyRundown, importRundown } from '~/store/rundowns'
import { verifyImportIsRundown } from '~/util/verifyImport'
import type { Rundown } from '~backend/background/interfaces'

export const Route = createFileRoute('/_root/')({
	component: Index
})

function Index() {
	const [activeTab, setActiveTab] = useState<string | null>('rundowns')
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const rundowns = useAppSelector((state) => state.rundowns)
	const toasts = useToasts()

	const createNewRundown = useCallback(
		(isTemplate: boolean) => {
			dispatch(addNewRundown({ playlistId: null, isTemplate })).unwrap()
		},
		[dispatch]
	)
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

	const selectImportRundown = (isTemplate: boolean) => {
		ipcAPI
			.openFromFile({ title: 'Import rundown' })
			.then(async (serializedRundown) => {
				console.log('opening rundown', serializedRundown)

				if (verifyImportIsRundown(serializedRundown)) {
					const existing = rundowns.find((rd) => rd.id === serializedRundown.rundown.id)
					if (existing) {
						toasts.show({
							headerContent: 'Importing rundown',
							bodyContent: 'Rundown already exists'
						})
					} else {
						try {
							await dispatch(importRundown({ ...serializedRundown, isTemplate })).unwrap()

							await navigate({
								to: `/rundown/${serializedRundown.rundown.id}`
							})
						} catch (e: unknown) {
							console.error(e)
							toasts.show({
								headerContent: 'Importing rundown',
								bodyContent: 'Encountered an unexpected error'
							})
						}
					}
				} else {
					toasts.show({
						headerContent: 'Importing rundown',
						bodyContent: 'Imported file is not a valid rundown'
					})
				}
			})
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Importing rundown',
					bodyContent: 'Encountered an unexpected error'
				})
			})
	}
	const templateRundowns = rundowns.filter((r) => r.isTemplate)
	const normalRundowns = rundowns.filter((r) => !r.isTemplate)
	return (
		<div className="p-2">
			<Stack direction="horizontal" className="mb-3 align-items-center">
				<Tabs
					className="flex-grow-1"
					defaultActiveKey="rundowns"
					activeKey={activeTab ?? 'rundowns'}
					onSelect={(k) => setActiveTab(k)}
				>
					<Tab eventKey="rundowns" title="Rundowns" />
					<Tab eventKey="templates" title="Templates" />
				</Tabs>
				<Stack direction="horizontal" gap={2}>
					<SplitButton
						title={
							<span className="d-inline-flex align-items-center gap-2">
								<BsPlus className="bttn-icon icon-lg" aria-hidden />
								New Rundown
							</span>
						}
						onClick={() => createNewRundown(activeTab === 'templates')}
						variant="primary"
						size="lg"
					>
						{templateRundowns.map((templateRundown) => (
							<Dropdown.Item
								key={templateRundown.id}
								onClick={() => handleCopyRundown(templateRundown, activeTab === 'templates')}
							>
								{templateRundown.name}
							</Dropdown.Item>
						))}
					</SplitButton>
					<Button onClick={() => selectImportRundown(activeTab === 'templates')} variant="outline-primary" size="lg">
						<BsBoxArrowInUp className="bttn-icon icon-md me-2" aria-hidden />
						Import
					</Button>
				</Stack>
			</Stack>
			{activeTab === 'rundowns' && <RundownListGrouped rundowns={normalRundowns} />}

			{activeTab === 'templates' && <RundownListGrouped rundowns={templateRundowns} />}
		</div>
	)
}
