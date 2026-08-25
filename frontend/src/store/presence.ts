import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type PresenceEntityType = 'part' | 'piece'

export interface PresenceFocus {
	socketId: string
	userId: string
	displayName: string
	entityType: PresenceEntityType
	entityId: string
	rundownId: string
}

interface PresenceState {
	focuses: PresenceFocus[]
}

const initialState: PresenceState = {
	focuses: []
}

const presenceSlice = createSlice({
	name: 'presence',
	initialState,
	reducers: {
		setPresenceFocuses(state, action: PayloadAction<PresenceFocus[]>) {
			state.focuses = action.payload
		}
	}
})

export const { setPresenceFocuses } = presenceSlice.actions
export const presenceReducer = presenceSlice.reducer
