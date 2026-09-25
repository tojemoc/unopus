import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '~/components/layout/AppShell'

export const Route = createFileRoute('/_root')({
	component: () => (
		<AppShell>
			<div className="app-page">
				<Outlet />
			</div>
		</AppShell>
	)
})
