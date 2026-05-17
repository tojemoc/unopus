import { createFileRoute, Outlet } from '@tanstack/react-router'
import { DuopusNavbar } from '~/components/navbar/duopusNavbar'

export const Route = createFileRoute('/_root')({
	component: () => (
		<>
			<DuopusNavbar />

			<Outlet />
		</>
	)
})
