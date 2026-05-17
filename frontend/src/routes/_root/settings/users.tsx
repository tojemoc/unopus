import { createFileRoute, redirect } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Table } from 'react-bootstrap'
import type { AuthUser, UserRole } from '~/lib/authApi'
import * as authApi from '~/lib/authApi'
import { useAppSelector } from '~/store/app'

export const Route = createFileRoute('/_root/settings/users')({
	beforeLoad: ({ context }) => {
		const user = context.store.getState().auth.user
		if (user?.role !== 'admin') {
			throw redirect({ to: '/settings/connection' })
		}
	},
	component: UsersSettingsPage
})

function UsersSettingsPage() {
	const currentUser = useAppSelector((s) => s.auth.user)
	const [users, setUsers] = useState<AuthUser[]>([])
	const [error, setError] = useState<string | null>(null)
	const [username, setUsername] = useState('')
	const [displayName, setDisplayName] = useState('')
	const [password, setPassword] = useState('')
	const [role, setRole] = useState<UserRole>('editor')

	const loadUsers = useCallback(async () => {
		try {
			setUsers(await authApi.listUsers())
			setError(null)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load users')
		}
	}, [])

	useEffect(() => {
		void loadUsers()
	}, [loadUsers])

	const onCreate = async (e: FormEvent) => {
		e.preventDefault()
		try {
			await authApi.createUser({ username, password, displayName, role })
			setUsername('')
			setDisplayName('')
			setPassword('')
			setRole('editor')
			await loadUsers()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to create user')
		}
	}

	const deactivate = async (id: string) => {
		await authApi.updateUser(id, { active: false })
		await loadUsers()
	}

	const resetPassword = async (id: string) => {
		const newPassword = window.prompt('New password for this user:')
		if (!newPassword) {
			return
		}
		await authApi.updateUser(id, { password: newPassword })
	}

	return (
		<div>
			<h2>Users</h2>
			{error && <Alert variant="danger">{error}</Alert>}

			<Table striped bordered hover size="sm" className="mt-3">
				<thead>
					<tr>
						<th>Username</th>
						<th>Display name</th>
						<th>Role</th>
						<th>Status</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{users.map((user) => (
						<tr key={user.id}>
							<td>{user.username}</td>
							<td>
								<Form.Control
									size="sm"
									defaultValue={user.displayName}
									onBlur={(e) =>
										void authApi
											.updateUser(user.id, { displayName: e.target.value })
											.then(loadUsers)
									}
								/>
							</td>
							<td>
								<Form.Select
									size="sm"
									value={user.role}
									disabled={user.id === currentUser?.id}
									onChange={(e) =>
										void authApi
											.updateUser(user.id, { role: e.target.value as UserRole })
											.then(loadUsers)
									}
								>
									<option value="editor">Editor</option>
									<option value="admin">Admin</option>
								</Form.Select>
							</td>
							<td>{user.active === false ? 'Inactive' : 'Active'}</td>
							<td className="text-nowrap">
								<Button size="sm" variant="outline-secondary" className="me-1" onClick={() => void resetPassword(user.id)}>
									Reset password
								</Button>
								{user.active !== false && user.id !== currentUser?.id && (
									<Button size="sm" variant="outline-danger" onClick={() => void deactivate(user.id)}>
										Deactivate
									</Button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</Table>

			<h3 className="h5 mt-4">Add user</h3>
			<Form onSubmit={onCreate} className="mt-2" style={{ maxWidth: '28rem' }}>
				<Form.Group className="mb-2">
					<Form.Label>Username</Form.Label>
					<Form.Control value={username} onChange={(e) => setUsername(e.target.value)} required />
				</Form.Group>
				<Form.Group className="mb-2">
					<Form.Label>Display name</Form.Label>
					<Form.Control value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
				</Form.Group>
				<Form.Group className="mb-2">
					<Form.Label>Password</Form.Label>
					<Form.Control
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</Form.Group>
				<Form.Group className="mb-3">
					<Form.Label>Role</Form.Label>
					<Form.Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
						<option value="editor">Editor</option>
						<option value="admin">Admin</option>
					</Form.Select>
				</Form.Group>
				<Button type="submit" variant="primary">
					Create user
				</Button>
			</Form>
		</div>
	)
}
