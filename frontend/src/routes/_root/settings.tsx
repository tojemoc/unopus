import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Tab, Tabs } from 'react-bootstrap'
import { MyErrorBoundary } from '~/util/errorBoundary'
import { useAppSelector } from '~/store/app'

export const Route = createFileRoute('/_root/settings')({
	component: RouteComponent
})

function RouteComponent() {
	const navigate = useNavigate()
	const isAdmin = useAppSelector((s) => s.auth.user?.role === 'admin')

	const matches = useRouterState({ select: (s) => s.matches })
	const pathPrefix = '/_root/settings/'
	const currentPath = matches.find((match) => match.id.startsWith(pathPrefix))
	const subPath = currentPath?.id.slice(pathPrefix.length) ?? ''

	const selectTab = (path: string | null) => {
		if (!path) return

		if (path === 'connection' || path === 'rundown' || path === 'users') {
			navigate({ to: `/settings/${path}` })
		} else {
			navigate({ to: `/settings/type/${path}` })
		}
	}
	return (
		<div className="p-4">
			<Tabs activeKey={subPath} onSelect={selectTab} className="mb-3" transition={false}>
				<Tab eventKey="connection" title="Connection" />
				<Tab eventKey="piece" title="Piece Types" />
				<Tab eventKey="part" title="Part Types" />
				<Tab eventKey="segment" title="Segment Types" />
				<Tab eventKey="rundown" title="Rundown Metadata" />
				{isAdmin && <Tab eventKey="users" title="Users" />}
			</Tabs>

			<MyErrorBoundary>
				<Outlet />
			</MyErrorBoundary>
		</div>
	)
}
