import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { StoryLibraryEntry } from '~backend/background/interfaces'
import { createAppAsyncThunk } from './app'
import { ipcAPI } from '~/lib/IPC'

export const searchStoryLibrary = createAppAsyncThunk(
	'storyLibrary/search',
	async (query: string) => ipcAPI.searchStoryLibrary(query)
)

interface StoryLibraryState {
	isOpen: boolean
	searchQuery: string
	searchResults: StoryLibraryEntry[]
	searchStatus: 'idle' | 'pending' | 'succeeded' | 'failed'
	error: string | null
	latestSearchRequestId: string | null
}

const initialState: StoryLibraryState = {
	isOpen: false,
	searchQuery: '',
	searchResults: [],
	searchStatus: 'idle',
	error: null,
	latestSearchRequestId: null
}

const storyLibrarySlice = createSlice({
	name: 'storyLibrary',
	initialState,
	reducers: {
		setStoryLibraryOpen(state, action: PayloadAction<boolean>) {
			state.isOpen = action.payload
		},
		toggleStoryLibrary(state) {
			state.isOpen = !state.isOpen
		},
		setStoryLibraryQuery(state, action: PayloadAction<string>) {
			state.searchQuery = action.payload
		}
	},
	extraReducers: (builder) => {
		builder
			.addCase(searchStoryLibrary.pending, (state, action) => {
				state.searchStatus = 'pending'
				state.error = null
				state.latestSearchRequestId = action.meta.requestId
			})
			.addCase(searchStoryLibrary.fulfilled, (state, action) => {
				if (action.meta.requestId !== state.latestSearchRequestId) {
					return
				}
				state.searchStatus = 'succeeded'
				state.searchResults = action.payload
			})
			.addCase(searchStoryLibrary.rejected, (state, action) => {
				if (action.meta.requestId !== state.latestSearchRequestId) {
					return
				}
				state.searchStatus = 'failed'
				state.error = action.error.message ?? 'Search failed'
			})
	}
})

export const { setStoryLibraryOpen, toggleStoryLibrary, setStoryLibraryQuery } =
	storyLibrarySlice.actions
export default storyLibrarySlice.reducer
