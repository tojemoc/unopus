import { Link, useMatchRoute, useNavigate, useParams } from '@tanstack/react-router'
import classNames from 'classnames'
import {
	BsArchive,
	BsCalendar3,
	BsChevronBarLeft,
	BsChevronBarRight,
	BsCollectionPlay,
	BsGear,
	BsPeople,
	BsPlusLg,
	BsPlug
} from 'react-icons/bs'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { addNewRundown } from '~/store/rundowns'
import { canEditRundown } from '~/util/roles'
import { HOME_TAB_KEY } from '~/util/homeTab'
import { useAppChrome } from './AppChromeContext'
import './appSidebar.scss'

type NavItem = {
	id: string
	label: string
	icon: React.ReactNode
	to?: string
	params?: Record<string, string>
	onClick?: () => void
	active?: boolean
	disabled?: boolean
	title?: string
}

function readHomeTab(): string {
	try {
		return sessionStorage.getItem(HOME_TAB_KEY) ?? 'rundowns'
	} catch {
		return 'rundowns'
	}
}

export function AppSidebar() {
	const { sidebarCollapsed, toggleSidebar } = useAppChrome()
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()
	const userRole = useAppSelector((s) => s.auth.user?.role)
	const canEdit = canEditRundown(userRole)
	const rundowns = useAppSelector((s) => s.rundowns)

	const rundownParams = useParams({ strict: false }) as { rundownId?: string }
	const currentRundownId = rundownParams.rundownId
	const currentRundown = currentRundownId
		? rundowns.find((r) => r.id === currentRundownId)
		: undefined

	const isHome = Boolean(matchRoute({ to: '/' }))
	const isSettings = Boolean(matchRoute({ to: '/settings', fuzzy: true }))
	const isUsers = Boolean(matchRoute({ to: '/settings/users' }))
	const isConnection = Boolean(matchRoute({ to: '/settings/connection' }))
	const homeTab = isHome ? readHomeTab() : null
	const isTemplatesTab = homeTab === 'templates'

	const createRundown = () => {
		if (!canEdit) return
		void dispatch(addNewRundown({ playlistId: null, isTemplate: false }))
			.unwrap()
			.then((rd) => navigate({ to: `/rundown/${rd.id}` }))
	}

	const goHomeTab = (tab: 'rundowns' | 'templates') => {
		try {
			sessionStorage.setItem(HOME_TAB_KEY, tab)
		} catch {
			/* ignore */
		}
		void navigate({ to: '/' })
		window.dispatchEvent(new CustomEvent('unopus-home-tab', { detail: tab }))
	}

	const rundownItems: NavItem[] = [
		{
			id: 'new',
			label: 'Nový rundown',
			icon: <BsPlusLg aria-hidden />,
			onClick: createRundown,
			disabled: !canEdit,
			title: canEdit ? 'Create a new rundown' : 'Viewer role — read-only'
		},
		...(currentRundown
			? [
					{
						id: 'current',
						label: currentRundown.name,
						icon: <BsCalendar3 aria-hidden />,
						to: '/rundown/$rundownId',
						params: { rundownId: currentRundown.id },
						active: true
					} satisfies NavItem
				]
			: []),
		{
			id: 'all',
			label: 'Všetky rundowns',
			icon: <BsCollectionPlay aria-hidden />,
			onClick: () => goHomeTab('rundowns'),
			active: isHome && !isTemplatesTab
		},
		{
			id: 'templates',
			label: 'Šablóny',
			icon: <BsArchive aria-hidden />,
			onClick: () => goHomeTab('templates'),
			active: isTemplatesTab,
			title: 'Templates'
		}
	]

	const systemItems: NavItem[] = [
		{
			id: 'settings',
			label: 'Nastavenia',
			icon: <BsGear aria-hidden />,
			to: '/settings/profile',
			active: isSettings && !isUsers && !isConnection
		},
		{
			id: 'users',
			label: 'Používatelia',
			icon: <BsPeople aria-hidden />,
			to: '/settings/users',
			active: isUsers,
			disabled: userRole !== 'admin',
			title: userRole !== 'admin' ? 'Admin only' : undefined
		},
		{
			id: 'integrations',
			label: 'Integrácie',
			icon: <BsPlug aria-hidden />,
			to: '/settings/connection',
			active: isConnection
		}
	]

	return (
		<aside
			className={classNames('app-sidebar', { 'app-sidebar--collapsed': sidebarCollapsed })}
			aria-label="Application navigation"
		>
			<button
				type="button"
				className="app-sidebar__collapse"
				onClick={toggleSidebar}
				aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				{sidebarCollapsed ? <BsChevronBarRight aria-hidden /> : <BsChevronBarLeft aria-hidden />}
			</button>

			<nav className="app-sidebar__nav">
				<SidebarSection title="Rundown" collapsed={sidebarCollapsed} items={rundownItems} />
				<SidebarSection title="Systém" collapsed={sidebarCollapsed} items={systemItems} />
			</nav>
		</aside>
	)
}

function SidebarSection({
	title,
	collapsed,
	items
}: {
	title: string
	collapsed: boolean
	items: NavItem[]
}) {
	return (
		<div className="app-sidebar__section">
			{!collapsed ? <div className="app-sidebar__section-title">{title}</div> : null}
			<ul className="app-sidebar__list">
				{items.map((item) => (
					<li key={item.id}>
						<SidebarLink item={item} collapsed={collapsed} />
					</li>
				))}
			</ul>
		</div>
	)
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
	const className = classNames('app-sidebar__item', {
		'app-sidebar__item--active': item.active,
		'app-sidebar__item--disabled': item.disabled
	})

	const content = (
		<>
			<span className="app-sidebar__icon">{item.icon}</span>
			{!collapsed ? <span className="app-sidebar__label">{item.label}</span> : null}
		</>
	)

	if (item.disabled) {
		return (
			<span className={className} title={item.title ?? item.label} aria-disabled="true">
				{content}
			</span>
		)
	}

	if (item.onClick && !item.to) {
		return (
			<button
				type="button"
				className={className}
				title={item.title ?? item.label}
				onClick={item.onClick}
			>
				{content}
			</button>
		)
	}

	if (item.to) {
		return (
			<Link
				to={item.to}
				params={item.params}
				className={className}
				title={item.title ?? item.label}
				onClick={
					item.onClick
						? (e) => {
								e.preventDefault()
								item.onClick?.()
							}
						: undefined
				}
			>
				{content}
			</Link>
		)
	}

	return (
		<span className={className} title={item.title ?? item.label}>
			{content}
		</span>
	)
}
