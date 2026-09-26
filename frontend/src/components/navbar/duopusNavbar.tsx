import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Button } from 'react-bootstrap'
import type { Rundown } from '~backend/background/interfaces'
import {
	IconCalendarShow,
	IconClock,
	IconDiff,
	IconLogout,
	IconOnAir,
	IconSettingsGear,
	IconUnopusMark
} from '~/components/icons/broadcastIcons'
import { ThemeToggle } from '~/components/theme/ThemeToggle'
import { SyncControl } from '~/components/rundown/syncControl'
import { RundownPropertiesModal } from '~/components/rundown/rundownPropertiesModal'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { logout } from '~/store/auth'
import { toTime, toTimeDiff } from '~/util/lib'
import { resolvePartOnAirDuration } from '~/util/pieceDuration'
import { resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { useRundownReadinessContextOptional } from '~/hooks/RundownReadinessContext'
import './duopusNavbar.scss'

interface DuopusNavbarProps {
	/** @deprecated use rundown.name via rundown prop */
	rundownName?: string
	rundown?: Rundown
}

function userInitials(displayName: string): string {
	const parts = displayName.trim().split(/\s+/).filter(Boolean)
	if (parts.length === 0) return '?'
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
	return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function DuopusNavbar({ rundown, rundownName }: DuopusNavbarProps) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const user = useAppSelector((s) => s.auth.user)
	const [showSettings, setShowSettings] = useState(false)

	const onLogout = async () => {
		await dispatch(logout())
		await navigate({ to: '/login' })
	}

	const title = rundown?.name ?? rundownName

	return (
		<div className="duopus-navbar">
			<div className="duopus-navbar__left">
				<Link to="/" className="duopus-navbar__brand" title="All rundowns">
					<IconUnopusMark size={18} className="duopus-navbar__brand-mark" />
					<span>Unopus</span>
				</Link>
			</div>

			{rundown ? <RundownTimingCenter rundown={rundown} /> : <div className="duopus-navbar__center" />}

			<div className="duopus-navbar__right">
				{rundown ? (
					<>
						<RundownStatusChips rundown={rundown} />
						<div className="duopus-navbar__rundown-meta">
							<span className="duopus-navbar__rundown-name" title={title}>
								<IconCalendarShow size={14} className="duopus-navbar__rundown-icon" />
								{title}
							</span>
							<button
								type="button"
								className="duopus-navbar__icon-btn"
								aria-label="Rundown settings"
								title="Rundown settings"
								onClick={() => setShowSettings(true)}
							>
								<IconSettingsGear size={15} />
							</button>
						</div>
						<RundownPropertiesModal
							rundown={rundown}
							show={showSettings}
							onHide={() => setShowSettings(false)}
						/>
					</>
				) : null}

				<ThemeToggle />

				{user ? (
					<div className="duopus-navbar__user">
						<span className="duopus-navbar__avatar" aria-hidden>
							{userInitials(user.displayName)}
						</span>
						<span className="duopus-navbar__user-name">{user.displayName}</span>
						<button
							type="button"
							className="duopus-navbar__logout"
							onClick={() => void onLogout()}
							aria-label="Log out"
							title="Log out"
						>
							<IconLogout size={13} />
							<span className="duopus-navbar__logout-text">Log out</span>
						</button>
					</div>
				) : (
					<Button variant="outline-secondary" size="sm" onClick={() => void onLogout()}>
						Log out
					</Button>
				)}
			</div>
		</div>
	)
}

function RundownTimingCenter({ rundown }: { rundown: Rundown }) {
	const parts = useAppSelector((state) =>
		state.parts.parts.filter((p) => p.rundownId === rundown.id)
	)
	const pieces = useAppSelector((state) =>
		state.pieces.pieces.filter((p) => p.rundownId === rundown.id)
	)
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const settings = useAppSelector((s) => s.settings.settings)
	const scriptCps = resolveEffectiveScriptCps({
		userScriptCps,
		settingsCps: settings?.scriptCps
	})
	const durationOpts = useMemo(
		() => ({
			scriptCps,
			defaultDurationMode: settings?.iluDurationMode ?? 'auto'
		}),
		[scriptCps, settings?.iluDurationMode]
	)

	const start = rundown.expectedStartTime
		? new Date(rundown.expectedStartTime).toLocaleTimeString()
		: '—'

	const duration =
		!rundown.expectedStartTime || !rundown.expectedEndTime
			? '—'
			: toTime((rundown.expectedEndTime - rundown.expectedStartTime) / 1000)

	const actualDuration = useMemo(() => {
		return parts
			.filter((p) => !p.float && !p.skip)
			.map((part) => {
				const partPieces = pieces
					.filter((piece) => piece.partId === part.id)
					.map((piece) => ({
						pieceType: piece.pieceType,
						duration: piece.duration,
						skip: piece.skip
					}))
				return resolvePartOnAirDuration(part, partPieces, durationOpts) ?? 0
			})
			.reduce((a, b) => a + b, 0)
	}, [parts, pieces, durationOpts])

	let diff: string | number = '—'
	let diffNegative = false
	if (rundown.expectedStartTime && rundown.expectedEndTime) {
		const expectedDuration = rundown.expectedEndTime - rundown.expectedStartTime
		const delta = actualDuration - expectedDuration / 1000
		diff = toTimeDiff(delta)
		diffNegative = delta < 0
	}

	return (
		<div className="duopus-navbar__center">
			<div className="duopus-navbar__timing" aria-label="Rundown timing">
				<div className="timing-cell">
					<span className="timing-cell__label">
						<IconClock size={11} /> Expected start
					</span>
					<span className="timing-cell__value">{start}</span>
				</div>
				<div className="timing-cell">
					<span className="timing-cell__label">
						<IconClock size={11} /> Expected duration
					</span>
					<span className="timing-cell__value">{duration}</span>
				</div>
				<div className={`timing-cell${diffNegative ? ' timing-cell--alert' : ''}`}>
					<span className="timing-cell__label">
						<IconDiff size={11} /> DIF
					</span>
					<span className="timing-cell__value">{diff}</span>
				</div>
			</div>
		</div>
	)
}

function RundownStatusChips({ rundown }: { rundown: Rundown }) {
	const readiness = useRundownReadinessContextOptional()
	const readyCount = readiness?.readiness?.summary.readyMediaPieces ?? 0
	const totalCount = readiness?.readiness?.summary.totalMediaPieces ?? 0
	const mediaReady =
		!readiness?.loading && !readiness?.error && totalCount > 0 && readyCount === totalCount

	return (
		<div className="duopus-navbar__status">
			<span
				className={`status-pill ${mediaReady ? 'status-pill--ok' : 'status-pill--muted'}`}
				title={
					readiness?.error
						? readiness.error
						: totalCount === 0
							? 'No media items'
							: `${readyCount}/${totalCount} media items ready`
				}
			>
				<IconOnAir size={12} className="status-pill__icon" />
				{mediaReady ? 'On Air Ready' : totalCount === 0 ? 'No media' : 'Media pending'}
			</span>
			<SyncControl rundown={rundown} compact />
		</div>
	)
}
