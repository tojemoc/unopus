import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router'
import type { store } from '~/store/store'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect } from 'react'
import { ToastsProvider } from '~/components/toasts/toasts'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { initStore } from '~/store/init'
import { MyErrorBoundary } from '~/util/errorBoundary'
import { checkAuth } from '~/store/auth'

export const Route = createRootRouteWithContext<{
	store: typeof store
}>()({
	beforeLoad: async ({ context, location }) => {
		const isLogin = location.pathname === '/login'
		const result = await context.store.dispatch(checkAuth())
		const user = checkAuth.fulfilled.match(result) ? result.payload : null
		if (!user && !isLogin) {
			throw redirect({ to: '/login' })
		}
	},
	component: RootRoute
})

function RootRoute() {
	const appDispatch = useAppDispatch()

	// TODO: this is a hack to get the store to initialize
	// It should be done in a better way, but this is a quick port of the old code
	const authStatus = useAppSelector((s) => s.auth.status)

	useEffect(() => {
		if (authStatus === 'authenticated') {
			initStore(appDispatch)
		}
	}, [appDispatch, authStatus])

	return (
		<>
			<MyErrorBoundary>
				<ToastsProvider>
					<Outlet />
				</ToastsProvider>
			</MyErrorBoundary>
			<TanStackRouterDevtools position="top-left" />
		</>
	)
}
