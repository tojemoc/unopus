import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface RundownPlayoutState {
	rundownId: string
	activated: boolean
	rehearsal: boolean
	previousPartId: string | null
	currentPartId: string | null
	nextPartId: string | null
	currentSegmentId: string | null
	lockedPartIds: string[]
}

interface PlayoutState {
	byRundownId: Record<string, RundownPlayoutState>
}

const initialState: PlayoutState = {
	byRundownId: {}
}

const playoutSlice = createSlice({
	name: 'playout',
	initialState,
	reducers: {
		setRundownPlayoutState(state, action: PayloadAction<RundownPlayoutState>) {
			state.byRundownId[action.payload.rundownId] = action.payload
		},
		clearRundownPlayoutState(state, action: PayloadAction<string>) {
			delete state.byRundownId[action.payload]
		}
	}
})

export const { setRundownPlayoutState, clearRundownPlayoutState } = playoutSlice.actions
export const playoutReducer = playoutSlice.reducer
