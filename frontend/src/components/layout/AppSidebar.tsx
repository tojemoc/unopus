import { Link, useMatchRoute, useNavigate, useParams } from '@tanstack/react-router'
import classNames from 'classnames'
import { useEffect, useState } from 'react'
import {
	IconAllRundowns,
	IconCalendarShow,
	IconCollapseSidebar,
	IconExpandSidebar,
	IconIntegrations,
	IconPlusRundown,
	IconScripts,
	IconSettingsGear,
	IconTemplates,
	IconUsers
} from '~/components/icons/broadcastIcons'
import { useToasts } from '~/components/toasts/useToasts'
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
	const toasts = useToasts()
	const [homeTab, setHomeTab] = useState(readHomeTab)

	useEffect(() => {
		const onTab = (event: Event) => {
			const detail = (event as CustomEvent<string>).detail
			if (detail === 'rundowns' || detail === 'templates') {
				setHomeTab(detail)
			}
		}
		window.addEventListener('unopus-home-tab', onTab)
		return () => window.removeEventListener('unopus-home-tab', onTab)
	}, [])

	const rundownParams = useParams({ strict: false }) as { rundownId?: string }
	const currentRundownId = rundownParams.rundownId
	const currentRundown = currentRundownId
		? rundowns.find((r) => r.id === currentRundownId)
		: undefined

	const isHome = Boolean(matchRoute({ to: '/' }))
	const isSettings = Boolean(matchRoute({ to: '/settings', fuzzy: true }))
	const isUsers = Boolean(matchRoute({ to: '/settings/users' }))
	const isConnection = Boolean(matchRoute({ to: '/settings/connection' }))
	const isRewrite = Boolean(
		currentRundownId &&
			matchRoute({
				to: '/rundown/$rundownId/rewrite',
				params: { rundownId: currentRundownId }
			})
	)
	const isRundownEditor = Boolean(
		currentRundownId &&
			matchRoute({
				to: '/rundown/$rundownId',
				params: { rundownId: currentRundownId },
				fuzzy: true
			}) &&
			!isRewrite
	)
	const isTemplatesTab = isHome && homeTab === 'templates'

	const createRundown = () => {
		if (!canEdit) return
		void dispatch(addNewRundown({ playlistId: null, isTemplate: false }))
			.unwrap()
			.then((rd) => navigate({ to: `/rundown/${rd.id}` }))
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Adding rundown',
					bodyContent: 'Encountered an unexpected error'
				})
			})
	}

	const goHomeTab = (tab: 'rundowns' | 'templates') => {
		try {
			sessionStorage.setItem(HOME_TAB_KEY, tab)
		} catch {
			/* ignore */
		}
		setHomeTab(tab)
		void navigate({ to: '/' })
		window.dispatchEvent(new CustomEvent('unopus-home-tab', { detail: tab }))
	}

	const rundownItems: NavItem[] = [
		{
			id: 'new',
			label: 'Nový rundown',
			icon: <IconPlusRundown size={16} />,
			onClick: createRundown,
			disabled: !canEdit,
			title: canEdit ? 'Create a new rundown' : 'Viewer role — read-only'
		},
		...(currentRundown
			? [
					{
						id: 'current',
						label: currentRundown.name,
						icon: <IconCalendarShow size={16} />,
						to: '/rundown/$rundownId',
						params: { rundownId: currentRundown.id },
						active: isRundownEditor
					} satisfies NavItem,
					{
						id: 'scripts',
						label: 'Skripty',
						icon: <IconScripts size={16} />,
						to: '/rundown/$rundownId/rewrite',
						params: { rundownId: currentRundown.id },
						active: isRewrite,
						title: 'Daily rewrite / scripts'
					} satisfies NavItem
				]
			: []),
		{
			id: 'all',
			label: 'Všetky rundowns',
			icon: <IconAllRundowns size={16} />,
			onClick: () => goHomeTab('rundowns'),
			active: isHome && !isTemplatesTab
		},
		{
			id: 'templates',
			label: 'Šablóny',
			icon: <IconTemplates size={16} />,
			onClick: () => goHomeTab('templates'),
			active: isTemplatesTab,
			title: 'Templates'
		}
	]

	const systemItems: NavItem[] = [
		{
			id: 'settings',
			label: 'Nastavenia',
			icon: <IconSettingsGear size={16} />,
			to: '/settings/profile',
			active: isSettings && !isUsers && !isConnection
		},
		{
			id: 'users',
			label: 'Používatelia',
			icon: <IconUsers size={16} />,
			to: '/settings/users',
			active: isUsers,
			disabled: userRole !== 'admin',
			title: userRole !== 'admin' ? 'Admin only' : undefined
		},
		{
			id: 'integrations',
			label: 'Integrácie',
			icon: <IconIntegrations size={16} />,
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
				{sidebarCollapsed ? <IconExpandSidebar size={16} /> : <IconCollapseSidebar size={16} />}
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
