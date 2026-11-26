import { useState } from 'react'
import { Button } from 'react-bootstrap'
import type { MutationPieceUpdate } from '~backend/background/interfaces'
import { ipcAPI } from '~/lib/IPC'
import { fetchMediaDurationSeconds } from '~/lib/mediaApi'
import { useAppDispatch } from '~/store/app'
import { updatePiece } from '~/store/pieces'
import { useToasts } from '../toasts/useToasts'

/** Payload keys holding an ingest-relative clip path — a piece has at most one. */
const CLIP_PAYLOAD_KEYS = ['fileName', 'iluFile'] as const

/** Re-run ffprobe over every clip piece of a rundown and refresh
 *  `payload.sourceDuration` where the probe disagrees with the stored value.
 *  Never touches `duration` — On air is editorial. */
export function ReprobeClipLengthsButton({ rundownId }: { rundownId: string }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const [running, setRunning] = useState(false)

	const reprobe = async () => {
		if (running) return
		setRunning(true)
		let probed = 0
		let updated = 0
		try {
			const updates: { id: string; key: string; mediaPath: string; sourceDurationMs: number }[] = []
			for (const piece of await ipcAPI.getPieces(rundownId)) {
				const clip = CLIP_PAYLOAD_KEYS.map((key) => ({ key, path: piece.payload?.[key] })).find(
					(c) => typeof c.path === 'string' && c.path.trim()
				)
				if (!clip) continue
				probed++
				const mediaPath = (clip.path as string).trim()
				const seconds = await fetchMediaDurationSeconds(mediaPath).catch(() => undefined)
				if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) continue
				const sourceDurationMs = Math.round(seconds * 1000)
				if (piece.payload?.sourceDuration !== sourceDurationMs) {
					updates.push({ id: piece.id, key: clip.key, mediaPath, sourceDurationMs })
				}
			}

			// Re-read once before writing — drops updates whose file moved (or
			// piece vanished) since the probe, and takes the live playlistId.
			const freshById = new Map((await ipcAPI.getPieces(rundownId)).map((p) => [p.id, p]))
			for (const u of updates) {
				const piece = freshById.get(u.id)
				if (!piece || String(piece.payload?.[u.key] ?? '').trim() !== u.mediaPath) continue
				// The backend merge-patches the document, so a sparse update touches
				// only sourceDuration — playlistId must ride along or the column nulls out.
				await dispatch(
					updatePiece({
						piece: {
							id: u.id,
							playlistId: piece.playlistId,
							payload: { sourceDuration: u.sourceDurationMs }
						} as unknown as MutationPieceUpdate
					})
				).unwrap()
				updated++
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
