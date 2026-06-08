import { configureStore } from '@reduxjs/toolkit'
import connectionStatusReducer from './connectionStatus.js'
import playlistsReducer from './playlists.js'
import rundownsReducer from './rundowns.js'
import segmentsReducer from './segments.js'
import templateSegmentsReducer from './templateSegments.js'
import partsReducer from './parts.js'
import piecesReducer from './pieces.js'
import typeManifestReducer from './typeManifest.js'
import settingsReducer from './settings.js'
import { authReducer } from './auth.js'
import storyLibraryReducer from './storyLibrary.js'

export const store = configureStore({
	reducer: {
		auth: authReducer,
		storyLibrary: storyLibraryReducer,
		playlists: playlistsReducer,
		rundowns: rundownsReducer,
		segments: segmentsReducer,
		templateSegments: templateSegmentsReducer,
		parts: partsReducer,
		pieces: piecesReducer,
		settings: settingsReducer,
		typeManifests: typeManifestReducer,
		coreConnectionStatus: connectionStatusReducer
	}
})
