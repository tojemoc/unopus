import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { Button, Dropdown, SplitButton, Stack, Tab, Tabs } from 'react-bootstrap'
import { BsBoxArrowInUp, BsPlus } from 'react-icons/bs'
import { RundownHomeList } from '~/components/rundownList/rundownHomeList'
import { TemplateList } from '~/components/rundownList/templateList'
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
	const isTemplatesTab = activeTab === 'templates'

	const createNewRundown = useCallback(
		(isTemplate: boolean) => {
			dispatch(addNewRundown({ playlistId: null, isTemplate }))
				.unwrap()
				.then((created) =>
					navigate({
						to: `/rundown/${created.id}`
					})
				)
				.catch((e) => {
					console.error(e)
					toasts.show({
						headerContent: isTemplate ? 'New template' : 'New rundown',
						bodyContent: 'Could not create'
					})
				})
		},
		[dispatch, navigate, toasts]
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
			.openFromFile({ title: isTemplate ? 'Import template' : 'Import rundown' })
			.then(async (serializedRundown) => {
				if (verifyImportIsRundown(serializedRundown)) {
					const existing = rundowns.find((rd) => rd.id === serializedRundown.rundown.id)
					if (existing) {
						toasts.show({
							headerContent: 'Import',
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
								headerContent: 'Import',
								bodyContent: 'Encountered an unexpected error'
							})
						}
					}
				} else {
					toasts.show({
						headerContent: 'Import',
						bodyContent: 'Imported file is not a valid rundown'
					})
				}
			})
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Import',
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
								<BsPlus aria-hidden />
								{isTemplatesTab ? 'New Template' : 'New Rundown'}
							</span>
						}
						onClick={() => createNewRundown(isTemplatesTab)}
						variant="primary"
					>
						{templateRundowns.length === 0 ? (
							<Dropdown.Item disabled>
								No templates yet — create one on the Templates tab
							</Dropdown.Item>
						) : (
							templateRundowns.map((templateRundown) => (
								<Dropdown.Item
									key={templateRundown.id}
									onClick={() => handleCopyRundown(templateRundown, isTemplatesTab)}
								>
									From {templateRundown.name}
								</Dropdown.Item>
							))
						)}
					</SplitButton>
					{!isTemplatesTab && (
						<Button
							onClick={() => selectImportRundown(false)}
							variant="outline-primary"
							className="d-inline-flex align-items-center gap-2"
						>
							<BsBoxArrowInUp aria-hidden />
							Import
						</Button>
					)}
				</Stack>
			</Stack>
			{activeTab === 'rundowns' && <RundownHomeList rundowns={normalRundowns} />}
			{activeTab === 'templates' && (
				<TemplateList
					templates={templateRundowns}
					onImportTemplate={() => selectImportRundown(true)}
				/>
			)}
		</div>
	)
}
