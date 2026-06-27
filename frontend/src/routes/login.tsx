import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Alert, Button, Card, Container, Form, Stack } from 'react-bootstrap'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { checkAuth, login } from '~/store/auth'
import { ThemeToggle } from '~/components/theme/ThemeToggle'

export const Route = createFileRoute('/login')({
	beforeLoad: async ({ context }) => {
		const result = await context.store.dispatch(checkAuth())
		if (checkAuth.fulfilled.match(result) && result.payload) {
			throw redirect({ to: '/' })
		}
	},
	component: LoginPage
})

function LoginPage() {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const authError = useAppSelector((s) => s.auth.error)
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [submitting, setSubmitting] = useState(false)

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault()
		setSubmitting(true)
		const result = await dispatch(login({ username, password }))
		setSubmitting(false)
		if (login.fulfilled.match(result)) {
			await navigate({ to: '/' })
		}
	}

	return (
		<Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
			<Stack gap={3} style={{ width: '100%', maxWidth: '26rem' }}>
				<div className="d-flex justify-content-end">
					<ThemeToggle />
				</div>
				<Card className="p-2">
					<Card.Body>
						<h1 className="h3 mb-1">Unopus</h1>
						<p className="text-muted mb-4">Sign in to edit rundowns</p>
					{authError && <Alert variant="danger">{authError}</Alert>}
					<Form onSubmit={onSubmit}>
						<Form.Group className="mb-3">
							<Form.Label>Username</Form.Label>
							<Form.Control
								autoComplete="username"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
							/>
						</Form.Group>
						<Form.Group className="mb-3">
							<Form.Label>Password</Form.Label>
							<Form.Control
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</Form.Group>
						<Button type="submit" variant="primary" className="w-100" disabled={submitting}>
							{submitting ? 'Signing in…' : 'Sign in'}
						</Button>
					</Form>
				</Card.Body>
			</Card>
			</Stack>
		</Container>
	)
}
