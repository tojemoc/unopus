import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MyErrorBoundary } from '~/util/errorBoundary'

export const Route = createFileRoute('/_root/settings')({
	component: RouteComponent
})

function RouteComponent() {
	return (
		<div className="p-4">
			<MyErrorBoundary>
				<Outlet />
			</MyErrorBoundary>
		</div>
	)
}
