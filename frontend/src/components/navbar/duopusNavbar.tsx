import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import Container from 'react-bootstrap/esm/Container'
import Nav from 'react-bootstrap/esm/Nav'
import Navbar from 'react-bootstrap/esm/Navbar'
import { Button, Stack } from 'react-bootstrap'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { logout } from '~/store/auth'
import { ClockDisplay } from './clockDisplay'
import './duopusNavbar.scss'

interface DuopusNavbarProps {
	rundownName?: string
}

export function DuopusNavbar({ rundownName }: DuopusNavbarProps) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const user = useAppSelector((s) => s.auth.user)
	const matchRoute = useMatchRoute()

	const onLogout = async () => {
		await dispatch(logout())
		await navigate({ to: '/login' })
	}

	const isRundowns = Boolean(matchRoute({ to: '/' }))
	const isSettings = Boolean(matchRoute({ to: '/settings', fuzzy: true }))

	return (
		<Navbar expand="lg" className="duopus-navbar">
			<Container fluid>
				<Navbar.Brand as={Link} to="/" className="brand-text">
					Duopus
				</Navbar.Brand>
				{rundownName && (
					<Navbar.Text className="ms-2 text-light">
						<span className="text-muted">/</span> {rundownName}
					</Navbar.Text>
				)}
				<Navbar.Toggle aria-controls="duopus-navbar" />
				<Navbar.Collapse id="duopus-navbar">
					<Nav className="me-auto ms-3">
						<Nav.Link as={Link} to="/" active={isRundowns}>
							Rundowns
						</Nav.Link>
						<Nav.Link as={Link} to="/settings/connection" active={isSettings}>
							Settings
						</Nav.Link>
					</Nav>
					<Stack direction="horizontal" gap={3} className="align-items-center">
						<ClockDisplay />
						{user && <span className="user-label">{user.displayName}</span>}
						<Button variant="outline-secondary" size="sm" onClick={onLogout}>
							Log out
						</Button>
					</Stack>
				</Navbar.Collapse>
			</Container>
		</Navbar>
	)
}
