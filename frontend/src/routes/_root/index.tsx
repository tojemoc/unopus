import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { Button, Dropdown, SplitButton, Stack, Tab, Tabs } from 'react-bootstrap'
import { IconImport, IconPlusRundown } from '~/components/icons/broadcastIcons'
import { RundownListGrouped } from '~/components/rundownList/rundownListGrouped'
import { useToasts } from '~/components/toasts/useToasts'
import { ipcAPI } from '~/lib/IPC'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { addNewRundown, copyRundown, importRundown } from '~/store/rundowns'
import { verifyImportIsRundown } from '~/util/verifyImport'
import { HOME_TAB_KEY } from '~/util/homeTab'
import type { Rundown } from '~backend/background/interfaces'

export const Route = createFileRoute('/_root/')({
	component: Index
})

function readHomeTab(): string {
	try {
		return sessionStorage.getItem(HOME_TAB_KEY) ?? 'rundowns'
	} catch {
		return 'rundowns'
	}
}

function Index() {
	const [activeTab, setActiveTab] = useState<string | null>(() => readHomeTab())
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const rundowns = useAppSelector((state) => state.rundowns)
	const toasts = useToasts()

	useEffect(() => {
		const onTab = (event: Event) => {
			const detail = (event as CustomEvent<string>).detail
			if (detail === 'rundowns' || detail === 'templates') {
				setActiveTab(detail)
			}
		}
		window.addEventListener('unopus-home-tab', onTab)
		return () => window.removeEventListener('unopus-home-tab', onTab)
	}, [])

	const selectTab = (tab: string | null) => {
		const next = tab ?? 'rundowns'
		setActiveTab(next)
		try {
			sessionStorage.setItem(HOME_TAB_KEY, next)
		} catch {
			/* ignore */
		}
		window.dispatchEvent(new CustomEvent('unopus-home-tab', { detail: next }))
	}

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
		<div className="app-page__inner">
			<Stack direction="horizontal" className="mb-3 align-items-center app-page__toolbar">
				<Tabs
					className="flex-grow-1"
					defaultActiveKey="rundowns"
					activeKey={activeTab ?? 'rundowns'}
					onSelect={selectTab}
				>
					<Tab eventKey="rundowns" title="Rundowns" />
					<Tab eventKey="templates" title="Templates" />
				</Tabs>
				<Stack direction="horizontal" gap={2} className="rundown-actions">
					<SplitButton
						title={
							<span className="d-inline-flex align-items-center gap-2">
								<span className="d-inline-flex" aria-hidden>
									<IconPlusRundown size={16} />
								</span>
								New Rundown
							</span>
						}
						onClick={() => createNewRundown(activeTab === 'templates')}
						variant="primary"
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
					<Button onClick={() => selectImportRundown(activeTab === 'templates')} variant="outline-primary">
						<span className="d-inline-flex align-items-center gap-2">
							<span className="d-inline-flex" aria-hidden>
								<IconImport size={15} />
							</span>
							Import
						</span>
					</Button>
				</Stack>
			</Stack>
			{activeTab === 'rundowns' && <RundownListGrouped rundowns={normalRundowns} />}

			{activeTab === 'templates' && <RundownListGrouped rundowns={templateRundowns} />}
		</div>
	)
}
