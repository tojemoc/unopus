import type { ReactNode } from 'react'
import classNames from 'classnames'
import { DuopusNavbar } from '~/components/navbar/duopusNavbar'
import type { Rundown } from '~backend/background/interfaces'
import { AppChromeProvider, useAppChrome } from './AppChromeContext'
import { AppSidebar } from './AppSidebar'
import './appShell.scss'

function AppShellInner({
	children,
	rundown,
	showSidebar = true
}: {
	children: ReactNode
	rundown?: Rundown
	showSidebar?: boolean
}) {
	const { sidebarCollapsed } = useAppChrome()

	return (
		<div
			className={classNames('app-shell', {
				'app-shell--sidebar-collapsed': sidebarCollapsed,
				'app-shell--no-sidebar': !showSidebar
			})}
		>
			<header className="app-shell__header">
				<DuopusNavbar rundown={rundown} />
			</header>
			{showSidebar ? <AppSidebar /> : null}
			<main className="app-shell__main">{children}</main>
		</div>
	)
}

export function AppShell({
	children,
	rundown,
	showSidebar = true
}: {
	children: ReactNode
	rundown?: Rundown
	showSidebar?: boolean
}) {
	return (
		<AppChromeProvider>
			<AppShellInner rundown={rundown} showSidebar={showSidebar}>
				{children}
			</AppShellInner>
		</AppChromeProvider>
	)
}
