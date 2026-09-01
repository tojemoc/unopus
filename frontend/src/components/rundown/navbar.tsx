import Container from 'react-bootstrap/esm/Container'
import Nav from 'react-bootstrap/esm/Nav'
import Navbar from 'react-bootstrap/esm/Navbar'
import { Link } from '@tanstack/react-router'
import { type Rundown } from '~backend/background/interfaces'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClose } from '@fortawesome/free-solid-svg-icons'
import { BsGear } from 'react-icons/bs'
import './navbar.scss'
import { toTime, toTimeDiff } from '~/util/lib'
import { useAppSelector } from '~/store/app'
import { Button, Stack } from 'react-bootstrap'
import { usePartInsertTarget } from '~/hooks/usePartInsertTarget'
import { PartTypeButtons } from './sidebar/partTypeButtons'
import { CoreDiagnosticsChip } from './coreDiagnosticsChip'
import { resolvePartOnAirDuration } from '~/util/pieceDuration'
import { resolveEffectiveScriptCps } from '~/util/scriptReadingTime'
import { useMemo, useState } from 'react'
import { RundownPropertiesModal } from './rundownPropertiesModal'

export function RundownNavbar({ rundown }: { rundown: Rundown }) {
	const [showSettings, setShowSettings] = useState(false)
	const parts = useAppSelector((state) =>
		state.parts.parts.filter((p) => p.rundownId === rundown.id)
	)
	const pieces = useAppSelector((state) =>
		state.pieces.pieces.filter((p) => p.rundownId === rundown.id)
	)
	const userScriptCps = useAppSelector((s) => s.auth.user?.scriptCps)
	const settingsCps = useAppSelector((s) => s.settings.settings?.scriptCps)
	const scriptCps = resolveEffectiveScriptCps({ userScriptCps, settingsCps })

	const insertTarget = usePartInsertTarget(rundown.id)

	const start = rundown.expectedStartTime
		? new Date(rundown.expectedStartTime).toLocaleTimeString()
		: 'Not set'

	const duration =
		!rundown.expectedStartTime || !rundown.expectedEndTime
			? 'Not set'
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
				return resolvePartOnAirDuration(part, partPieces, { scriptCps }) ?? 0
			})
			.reduce((a, b) => a + b, 0)
	}, [parts, pieces, scriptCps])

	let diff: string | number = '-'
	if (rundown.expectedStartTime && rundown.expectedEndTime) {
		const expectedDuration = rundown.expectedEndTime - rundown.expectedStartTime
		diff = toTimeDiff(actualDuration - expectedDuration / 1000)
	}

	return (
		<Navbar expand="lg" className="rundown-navbar">
			<Container fluid className="rundown-navbar__inner">
				<Stack className="timing" direction="horizontal" gap={3}>
					<CoreDiagnosticsChip compact />
					<Stack>
						<div className="label">Expected start:</div>
						<div>{start}</div>
					</Stack>
					<Stack>
						<div className="label">Expected duration:</div>
						<div>{duration}</div>
					</Stack>
					<Stack>
						<div className="label">Diff:</div>
						<div>{diff}</div>
					</Stack>
				</Stack>

				<div className="rundown-navbar__quick-add">
					{insertTarget ? (
						<PartTypeButtons
							segment={insertTarget.segment}
							rank={insertTarget.rank}
							insertHint={insertTarget.hint}
						/>
					) : (
						<PartTypeButtons disabled disabledReason="Open a story to add a part" />
					)}
				</div>

				<div className="rundown-navbar__title-row">
					<span className="rundown-navbar__title">{rundown.name}</span>
					<Button
						variant="link"
						size="sm"
						className="rundown-navbar__settings"
						aria-label="Rundown settings"
						title="Rundown settings"
						onClick={() => setShowSettings(true)}
					>
						<BsGear />
					</Button>
				</div>

				<Nav className="rundown-navbar__close align-items-center gap-2">
					<Nav.Link as={Link} to={`/rundown/${rundown.id}/rewrite`} className="small">
						Daily rewrite
					</Nav.Link>
					<Nav.Link as={Link} to="/">
						<FontAwesomeIcon icon={faClose} size="xl" />
					</Nav.Link>
				</Nav>
			</Container>
			<RundownPropertiesModal
				rundown={rundown}
				show={showSettings}
				onHide={() => setShowSettings(false)}
			/>
		</Navbar>
	)
}
