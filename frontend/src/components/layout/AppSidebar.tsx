import { Link, useMatchRoute, useNavigate, useParams } from '@tanstack/react-router'
import classNames from 'classnames'
import { useEffect, useState } from 'react'
import { BsChevronDown, BsChevronRight } from 'react-icons/bs'
import {
	IconAllRundowns,
	IconCalendarShow,
	IconCollapseSidebar,
	IconExpandSidebar,
	IconImport,
	IconIntegrations,
	IconPlusRundown,
	IconSettingsGear,
	IconTemplates,
	IconUsers
} from '~/components/icons/broadcastIcons'
import { useToasts } from '~/components/toasts/useToasts'
import { ipcAPI } from '~/lib/IPC'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { addNewRundown, importRundown } from '~/store/rundowns'
import { canEditRundown } from '~/util/roles'
import { verifyImportIsRundown } from '~/util/verifyImport'
import { HOME_TAB_KEY } from '~/util/homeTab'
import { useAppChrome } from './AppChromeContext'
import './appSidebar.scss'

type NavItem = {
	id: string
	label: string
	icon?: React.ReactNode
	to?: string
	params?: Record<string, string>
	onClick?: () => void
	active?: boolean
	disabled?: boolean
	title?: string
	expanded?: boolean
	children?: NavItem[]
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
	const isSettingsProfile = Boolean(matchRoute({ to: '/settings/profile' }))
	const isSettingsDiagnostics = Boolean(matchRoute({ to: '/settings/diagnostics' }))
	const isSettingsRundown = Boolean(matchRoute({ to: '/settings/rundown' }))
	const isPieceTypes = Boolean(
		matchRoute({ to: '/settings/type/$type', params: { type: 'piece' } })
	)
	const isPartTypes = Boolean(matchRoute({ to: '/settings/type/$type', params: { type: 'part' } }))
	const isSegmentTypes = Boolean(
		matchRoute({ to: '/settings/type/$type', params: { type: 'segment' } })
	)
	// On a settings page covered by the Nastavenia submenu (users/connection are
	// separate top-level items).
	const isSettingsSub = isSettings && !isUsers && !isConnection
	const [settingsOpen, setSettingsOpen] = useState(isSettingsSub)
	useEffect(() => {
		if (isSettingsSub) setSettingsOpen(true)
	}, [isSettingsSub])
	const isRundownEditor = Boolean(
		currentRundownId &&
			matchRoute({
				to: '/rundown/$rundownId',
				params: { rundownId: currentRundownId },
				fuzzy: true
			})
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

	const importRundownFile = () => {
		if (!canEdit) return
		ipcAPI
			.openFromFile({ title: 'Import rundown' })
			.then(async (serializedRundown) => {
				if (verifyImportIsRundown(serializedRundown)) {
					const existing = rundowns.find((rd) => rd.id === serializedRundown.rundown.id)
					if (existing) {
						toasts.show({
							headerContent: 'Importing rundown',
							bodyContent: 'Rundown already exists'
						})
					} else {
						try {
							await dispatch(
								importRundown({
									...serializedRundown,
									isTemplate: homeTab === 'templates'
								})
							).unwrap()
							await navigate({ to: `/rundown/${serializedRundown.rundown.id}` })
						} catch (e) {
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
		{
			id: 'import',
			label: 'Import',
			icon: <IconImport size={16} />,
			onClick: importRundownFile,
			disabled: !canEdit,
			title: canEdit ? 'Import rundown from a JSON file' : 'Viewer role — read-only'
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
					} satisfies NavItem
				]
			: []),
		{
			id: 'all',
			label: 'Všetky rundowny',
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
			onClick: () => {
				if (sidebarCollapsed) toggleSidebar()
				setSettingsOpen((open) => !open)
			},
			active: isSettingsSub,
			expanded: settingsOpen,
			children: [
				{
					id: 'settings-profile',
					label: 'Profil',
					to: '/settings/profile',
					active: isSettingsProfile
				},
				{
					id: 'settings-diagnostics',
					label: 'Diagnostika',
					to: '/settings/diagnostics',
					active: isSettingsDiagnostics
				},
				{
					id: 'settings-piece',
					label: 'Piece Types',
					to: '/settings/type/piece',
					active: isPieceTypes
				},
				{
					id: 'settings-part',
					label: 'Part Types',
					to: '/settings/type/part',
					active: isPartTypes
				},
				{
					id: 'settings-segment',
					label: 'Segment Types',
					to: '/settings/type/segment',
					active: isSegmentTypes
				},
				{
					id: 'settings-rundown',
					label: 'Rundown Metadata',
					to: '/settings/rundown',
					active: isSettingsRundown
				}
			]
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
						{item.children && item.expanded && !collapsed ? (
							<ul className="app-sidebar__sublist">
								{item.children.map((child) => (
									<li key={child.id}>
										<SidebarLink item={child} collapsed={collapsed} />
									</li>
								))}
							</ul>
						) : null}
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
			{item.icon ? <span className="app-sidebar__icon">{item.icon}</span> : null}
			{!collapsed ? <span className="app-sidebar__label">{item.label}</span> : null}
			{!collapsed && item.children ? (
				<span className="app-sidebar__chevron" aria-hidden>
					{item.expanded ? <BsChevronDown /> : <BsChevronRight />}
				</span>
			) : null}
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
