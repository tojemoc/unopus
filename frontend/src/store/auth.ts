import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { AuthUser } from '~/lib/authApi'
import * as authApi from '~/lib/authApi'

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'

interface AuthState {
	status: AuthStatus
	user: AuthUser | null
	error: string | null
}

const initialState: AuthState = {
	status: 'unknown',
	user: null,
	error: null
}

export const checkAuth = createAsyncThunk('auth/check', async () => {
	return authApi.fetchCurrentUser()
})

export const login = createAsyncThunk(
	'auth/login',
	async (payload: { username: string; password: string }, { rejectWithValue }) => {
		try {
			return await authApi.login(payload.username, payload.password)
		} catch (e) {
			return rejectWithValue(e instanceof Error ? e.message : 'Login failed')
		}
	}
)

export const logout = createAsyncThunk('auth/logout', async () => {
	await authApi.logout()
})

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {},
	extraReducers: (builder) => {
		builder
			.addCase(checkAuth.pending, (state) => {
				state.status = 'unknown'
				state.error = null
			})
			.addCase(checkAuth.fulfilled, (state, action) => {
				if (action.payload) {
					state.status = 'authenticated'
					state.user = action.payload
				} else {
					state.status = 'unauthenticated'
					state.user = null
				}
			})
			.addCase(checkAuth.rejected, (state) => {
				state.status = 'unauthenticated'
				state.user = null
			})
			.addCase(login.pending, (state) => {
				state.error = null
			})
			.addCase(login.fulfilled, (state, action) => {
				state.status = 'authenticated'
				state.user = action.payload
				state.error = null
			})
			.addCase(login.rejected, (state, action) => {
				state.status = 'unauthenticated'
				state.user = null
				state.error = (action.payload as string) ?? 'Login failed'
			})
			.addCase(logout.fulfilled, (state) => {
				state.status = 'unauthenticated'
				state.user = null
			})
	}
})

export const authReducer = authSlice.reducer
