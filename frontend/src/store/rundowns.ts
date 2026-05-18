import type {
	MutationRundownCopy,
	Rundown,
	SerializedRundown
} from '~backend/background/interfaces.js'
import { createSlice } from '@reduxjs/toolkit'
import { createAppAsyncThunk } from './app'
import { ipcAPI } from '~/lib/IPC'
import { assertIpcSuccess, parseImportFile } from '~/util/normalizeImport'
import { loadPieces } from './pieces'
import { loadParts } from './parts'
import { loadSegments } from './segments'

export interface NewRundownPayload {
	playlistId: string | null
	isTemplate?: boolean
}
export interface UpdateRundownPayload {
	rundown: Rundown
}
export interface RemoveRundownPayload {
	id: string
}

export const addNewRundown = createAppAsyncThunk(
	'rundowns/addNewRundown',
	async (initialRundown: NewRundownPayload) => {
		return ipcAPI.addNewRundown({
			name: 'New ' + (initialRundown.isTemplate ? 'Template' : 'Rundown'),
			sync: false,
			playlistId: initialRundown.playlistId,
			isTemplate: initialRundown.isTemplate ? true : false,
			payload: {}
		})
	}
)
export const copyRundown = createAppAsyncThunk(
	'rundown/copyRundown',
	async (payload: MutationRundownCopy, { dispatch }) => {
		const rundownResult = await ipcAPI.copyRundown(payload)

		dispatch(pushRundown(rundownResult))
		await dispatch(loadPieces({ rundownId: payload.id }))
		await dispatch(loadParts({ rundownId: payload.id }))
		await dispatch(loadSegments({ rundownId: payload.id }))

		return rundownResult
	}
)
export const updateRundown = createAppAsyncThunk(
	'rundowns/updateRundown',
	async (payload: UpdateRundownPayload) => {
		return ipcAPI.updateRundown(payload.rundown)
	}
)
export const removeRundown = createAppAsyncThunk(
	'rundowns/removeRundown',
	async (payload: RemoveRundownPayload) => {
		await ipcAPI.deleteRundown(payload.id)
		return payload
	}
)

export const importRundown = createAppAsyncThunk(
	'rundowns/importRundown',
	async (payload: SerializedRundown | { data: unknown; isTemplate: boolean }) => {
		const rundown =
			'data' in payload
				? parseImportFile(payload.data, payload.isTemplate)
				: parseImportFile(payload, payload.isTemplate ?? false)

		const createdRundown = assertIpcSuccess(
			await ipcAPI.addNewRundown({
				...rundown.rundown,
				sync: false,
				isTemplate: rundown.isTemplate ?? false
			})
		)

		const orderedSegments = [...rundown.segments].sort((a, b) => a.rank - b.rank)
		for (const [index, segment] of orderedSegments.entries()) {
			assertIpcSuccess(await ipcAPI.addNewSegment({ ...segment, rank: index }))
		}

		const partsGroupedBySegment: Record<string, typeof rundown.parts> = {}
		for (const part of rundown.parts) {
			if (!partsGroupedBySegment[part.segmentId]) {
				partsGroupedBySegment[part.segmentId] = []
			}
			partsGroupedBySegment[part.segmentId].push(part)
		}

		const orderedParts: typeof rundown.parts = []
		for (const segment of orderedSegments) {
			const parts = partsGroupedBySegment[segment.id]
			if (parts) {
				const sortedParts = parts
					.sort((a, b) => a.rank - b.rank)
					.map((part, index) => ({
						...part,
						rank: index
					}))
				orderedParts.push(...sortedParts)
			}
		}

		for (const part of orderedParts) {
			assertIpcSuccess(await ipcAPI.addNewPart(part))
		}
		for (const piece of rundown.pieces) {
			assertIpcSuccess(await ipcAPI.addNewPiece(piece))
		}

		return createdRundown
	}
)

const rundownsSlice = createSlice({
	name: 'rundowns',
	initialState: [] as Rundown[],
	reducers: {
		initRundowns: (_state, action: { type: string; payload: Rundown[] }) => {
			console.log('initRundowns', action)
			return action.payload
		},
		// TODO: prevent already existing IDs to be pushed
		pushRundown: (state, action: { type: string; payload: Rundown | Rundown[] }) => {
			if (Array.isArray(action.payload)) {
				state.push(...action.payload)
			} else {
				state.push(action.payload)
			}
		}
	},
	extraReducers(builder) {
		builder
			.addCase(addNewRundown.fulfilled, (state, action) => {
				state.push(action.payload)
			})
			.addCase(updateRundown.fulfilled, (state, action) => {
				const index = state.findIndex((rundown) => rundown.id === action.payload.id)
				if (index !== -1) {
					state[index] = action.payload
				}
			})
			.addCase(removeRundown.fulfilled, (state, action) => {
				const index = state.findIndex((rundown) => rundown.id === action.payload.id)
				if (index !== -1) {
					state.splice(index, 1)
				}
			})
			.addCase(importRundown.fulfilled, (state, action) => {
				// This must be a new rundown
				state.push(action.payload)
			})
	}
})

// Export the auto-generated action creator with the same name
export const { initRundowns } = rundownsSlice.actions
export const { pushRundown } = rundownsSlice.actions

export default rundownsSlice.reducer
