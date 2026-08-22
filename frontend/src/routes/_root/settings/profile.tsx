import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import { DEFAULT_SCRIPT_CPS, normalizeScriptCps } from '~/util/scriptReadingTime'
import { friendlyLabel } from '~/util/fieldLabels'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { updateMyProfile } from '~/store/auth'

export const Route = createFileRoute('/_root/settings/profile')({
	component: ProfileSettingsPage
})

function ProfileSettingsPage() {
	const dispatch = useAppDispatch()
	const user = useAppSelector((s) => s.auth.user)
	const settingsCps = useAppSelector((s) => s.settings.settings?.scriptCps)
	const siteDefaultCps = normalizeScriptCps(settingsCps ?? DEFAULT_SCRIPT_CPS)

	const [useSiteDefault, setUseSiteDefault] = useState(user?.scriptCps == null)
	const [scriptCps, setScriptCps] = useState(
		user?.scriptCps ?? siteDefaultCps
	)
	const [saved, setSaved] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!user) return
		const usesDefault = user.scriptCps == null
		setUseSiteDefault(usesDefault)
		setScriptCps(user.scriptCps ?? siteDefaultCps)
	}, [user, siteDefaultCps])

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault()
		setSaved(false)
		setError(null)
		try {
			await dispatch(
				updateMyProfile({
					scriptCps: useSiteDefault ? null : normalizeScriptCps(scriptCps)
				})
			).unwrap()
			setSaved(true)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save profile')
		}
	}

	if (!user) {
		return <Alert variant="warning">Sign in to edit your profile.</Alert>
	}

	return (
		<>
			<h2>Profile</h2>
			<p className="text-muted">
				Signed in as <strong>{user.displayName}</strong> ({user.username})
			</p>

			{error && <Alert variant="danger">{error}</Alert>}
			{saved && <Alert variant="success">Profile saved.</Alert>}

			<Form onSubmit={onSubmit} className="mt-3" style={{ maxWidth: '28rem' }}>
				<Form.Group className="mb-3">
					<Form.Label htmlFor="profile-script-cps">{friendlyLabel('scriptCps')}</Form.Label>
					<Form.Check
						type="checkbox"
						id="profile-use-site-default"
						label={`Use site default (${siteDefaultCps} CPS)`}
						checked={useSiteDefault}
						onChange={(e) => setUseSiteDefault(e.target.checked)}
						className="mb-2"
					/>
					<Form.Control
						id="profile-script-cps"
						type="number"
						min={5}
						max={40}
						step={1}
						value={useSiteDefault ? siteDefaultCps : scriptCps}
						disabled={useSiteDefault}
						onChange={(e) => setScriptCps(Number(e.target.value))}
					/>
					<Form.Text className="text-muted">
						Your personal reading speed for script → mm:ss estimates (5–40). Stored on your
						user account and used when you edit rundowns.
					</Form.Text>
				</Form.Group>

				<Button type="submit" variant="primary">
					Save profile
				</Button>
			</Form>
		</>
	)
}
