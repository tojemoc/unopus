import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { fetchMediaDurationSeconds } from '~/lib/mediaApi'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { updatePiece } from '~/store/pieces'
import { useToasts } from '../toasts/useToasts'

/** Payload keys holding an ingest-relative clip path — a piece has at most one. */
const CLIP_PAYLOAD_KEYS = ['fileName', 'iluFile'] as const

/** Re-run ffprobe over every clip piece in the open rundown and refresh
 *  `payload.sourceDuration` where the probe disagrees with the stored value.
 *  Never touches `duration` — On air is editorial. */
export function ReprobeClipLengthsButton() {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const pieces = useAppSelector((state) => state.pieces.pieces)
	const [running, setRunning] = useState(false)

	const reprobe = async () => {
		if (running) return
		setRunning(true)
		let probed = 0
		let updated = 0
		try {
			for (const piece of pieces) {
				for (const key of CLIP_PAYLOAD_KEYS) {
					const mediaPath = piece.payload?.[key]
					if (typeof mediaPath !== 'string' || !mediaPath.trim()) continue
					probed++
					const seconds = await fetchMediaDurationSeconds(mediaPath.trim()).catch(() => undefined)
					if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
						const sourceDurationMs = Math.round(seconds * 1000)
						if (piece.payload?.sourceDuration !== sourceDurationMs) {
							await dispatch(
								updatePiece({
									piece: {
										...piece,
										payload: { ...piece.payload, sourceDuration: sourceDurationMs }
									}
								})
							).unwrap()
							updated++
						}
					}
					break
				}
			}
			toasts.show({
				headerContent: 'Re-probe clip lengths',
				bodyContent: `Probed ${probed} clips — updated ${updated} source length${updated === 1 ? '' : 's'}.`
			})
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Re-probe clip lengths',
				bodyContent: 'Failed partway through — earlier pieces may already be updated.'
			})
		} finally {
			setRunning(false)
		}
	}

	return (
		<Button variant="secondary" className="me-2" disabled={running} onClick={() => void reprobe()}>
			{running ? 'Probing…' : 'Re-probe clip lengths'}
		</Button>
	)
}
