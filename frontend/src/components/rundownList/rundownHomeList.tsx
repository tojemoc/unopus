import { useMemo, useState } from 'react'
import { Button, Row } from 'react-bootstrap'
import type { Rundown } from '~backend/background/interfaces'
import { useAppSelector } from '~/store/app'
import { compareDateKeys, formatDateKey, rundownDateKey } from '~/util/timezone'
import { RundownCard } from './rundownCard'

interface RundownHomeListProps {
	rundowns: Rundown[]
}

export function RundownHomeList({ rundowns }: RundownHomeListProps) {
	const parts = useAppSelector((s) => s.parts.parts)
	const settings = useAppSelector((s) => s.settings.settings)
	const [showAllOlder, setShowAllOlder] = useState(false)

	const timeZone = settings?.timezone ?? 'Europe/Bratislava'
	const pastVisible = settings?.rundownListPastVisible ?? 2
	const futureVisible = settings?.rundownListFutureVisible ?? 4
	const todayKey = formatDateKey(timeZone)

	const { pastCollapsed, pastHidden, today, futureExpanded, futureHidden, undated } = useMemo(() => {
		const withKeys: Array<{ rundown: Rundown; dateKey: string | null }> = rundowns.map((r) => ({
			rundown: r,
			dateKey: rundownDateKey(timeZone, r)
		}))

		const dated = withKeys
			.filter((x): x is { rundown: Rundown; dateKey: string } => x.dateKey !== null)
			.sort((a, b) => compareDateKeys(a.dateKey, b.dateKey))

		const undatedList = withKeys.filter((x) => x.dateKey === null).map((x) => x.rundown)

		const past = dated.filter((x) => compareDateKeys(x.dateKey, todayKey) < 0)
		const todayItems = dated.filter((x) => x.dateKey === todayKey)
		const future = dated.filter((x) => compareDateKeys(x.dateKey, todayKey) > 0)

		const pastCollapsedSlice = past.slice(-pastVisible)
		const pastHiddenSlice = past.slice(0, Math.max(0, past.length - pastVisible))

		const futureExpandedSlice = future.slice(0, futureVisible)
		const futureHiddenSlice = future.slice(futureVisible)

		return {
			pastCollapsed: pastCollapsedSlice,
			pastHidden: pastHiddenSlice,
			today: todayItems,
			futureExpanded: futureExpandedSlice,
			futureHidden: futureHiddenSlice,
			undated: undatedList
		}
	}, [rundowns, timeZone, todayKey, pastVisible, futureVisible])

	if (rundowns.length === 0) {
		return (
			<div className="rundown-empty-state">
				<p>No rundowns yet. Create one to get started.</p>
			</div>
		)
	}

	const storyCount = (rundownId: string) => parts.filter((p) => p.rundownId === rundownId).length

	const renderSection = (
		title: string,
		items: Array<{ rundown: Rundown; dateKey?: string }>,
		collapsed: boolean
	) => {
		if (items.length === 0) {
			return null
		}
		return (
			<section key={title} className="mb-4">
				<h2 className="h5 text-muted mb-3">{title}</h2>
				<Row xs={1} md={2} lg={3} className="g-3">
					{items.map(({ rundown }) => (
						<RundownCard
							key={rundown.id}
							rundown={rundown}
							storyCount={storyCount(rundown.id)}
							collapsed={collapsed}
						/>
					))}
				</Row>
			</section>
		)
	}

	const olderPast = showAllOlder ? [...pastHidden, ...pastCollapsed] : pastCollapsed

	return (
		<div className="rundown-list-grouped">
			{pastHidden.length > 0 && !showAllOlder && (
				<div className="mb-3">
					<Button variant="outline-secondary" size="sm" onClick={() => setShowAllOlder(true)}>
						Show {pastHidden.length} older rundown{pastHidden.length === 1 ? '' : 's'}
					</Button>
				</div>
			)}
			{renderSection(
				'Earlier',
				olderPast.map((x) => ({ rundown: x.rundown })),
				true
			)}
			{renderSection('Today', today.map((x) => ({ rundown: x.rundown })), false)}
			{renderSection(
				'Upcoming',
				futureExpanded.map((x) => ({
					rundown: x.rundown,
					dateKey: x.dateKey
				})),
				false
			)}
			{futureHidden.length > 0 &&
				renderSection(
					'Later',
					futureHidden.map((x) => ({ rundown: x.rundown })),
					true
				)}
			{undated.length > 0 &&
				renderSection(
					'No date set',
					undated.map((rundown) => ({ rundown })),
					false
				)}
		</div>
	)
}
