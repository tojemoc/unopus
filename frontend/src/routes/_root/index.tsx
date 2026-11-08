import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { RundownListGrouped } from '~/components/rundownList/rundownListGrouped'
import { useAppSelector } from '~/store/app'
import { HOME_TAB_KEY } from '~/util/homeTab'

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
	const rundowns = useAppSelector((state) => state.rundowns)

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

	const templateRundowns = rundowns.filter((r) => r.isTemplate)
	const normalRundowns = rundowns.filter((r) => !r.isTemplate)
	return (
		<div className="app-page__inner">
			{activeTab === 'rundowns' && <RundownListGrouped rundowns={normalRundowns} />}

			{activeTab === 'templates' && <RundownListGrouped rundowns={templateRundowns} />}
		</div>
	)
}
