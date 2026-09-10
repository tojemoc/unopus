import type { Part } from '~backend/background/interfaces'

/**
 * Normalize imported parts to the current shape (`partType` + top-level `script`).
 *
 * Legacy exports put `type` / `script` / `duration` inside `payload`. Current
 * megarepo smoke exports keep those at the top level and still set
 * `payload.type` for Sofie ingest — that must NOT be treated as legacy, or
 * top-level `script` (and duration / skip / editorChecked) are wiped on import.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertOldPartToNew(part: any): Part {
	if (typeof part?.partType === 'string' && part.partType.length > 0) {
		return part as Part
	}

	if (part?.payload && typeof part.payload === 'object' && 'type' in part.payload) {
		const { type, script, duration, ...restPayload } = part.payload

		return {
			id: part.id,
			playlistId: part.playlistId ?? null,
			rundownId: part.rundownId,
			segmentId: part.segmentId,
			name: part.name,
			rank: part.rank,
			float: part.float,
			skip: part.skip,
			editorChecked: part.editorChecked,
			durationMode: part.durationMode,
			partType: type ?? 'unknown',
			script: part.script ?? script,
			duration: part.duration === undefined ? duration : part.duration,
			payload: restPayload
		}
	}

	return part as Part
}
