import { getSocketIO } from '../socket.js'
import { mutations as partsMutations } from '../api/parts.js'
import { mutations as piecesMutations } from '../api/pieces.js'
import { mutations as settingsMutations } from '../api/settings.js'
import { sendPartUpdateToCore } from '../api/parts.js'
import { broadcastStoryDurationSync } from '../storyDurationSync.js'
import { fetchImeteoForecast } from './fetchForecast.js'
import { citiesToJson, mapForecastToWeatherCities } from './mapForecast.js'
import type { WeatherSyncResult } from './types.js'
import type { Piece } from '../interfaces.js'

function findWeatherPiece(pieces: Piece[]): Piece | undefined {
	return pieces.find((piece) => piece.pieceType === 'weather' && !piece.skip)
}

/**
 * Pull iMeteo forecast into a part that already has a `weather` piece:
 * - piece.payload.cities ← GFX-compatible JSON string
 * - part.script ← forecastText (prompter copy)
 */
export async function syncWeatherPartFromImeteo(options: {
	partId: string
	day?: string | null
	fetchImpl?: typeof fetch
}): Promise<WeatherSyncResult> {
	const partId = options.partId?.trim()
	if (!partId) {
		throw new Error('Missing partId')
	}

	const { result: part, error: partError } = await partsMutations.readOne(partId)
	if (partError || !part) {
		throw partError ?? new Error(`Part ${partId} not found`)
	}

	const { result: pieces, error: piecesError } = await piecesMutations.read({ partId })
	if (piecesError) {
		throw piecesError
	}
	const list = Array.isArray(pieces) ? pieces : pieces ? [pieces] : []
	const weatherPiece = findWeatherPiece(list)
	if (!weatherPiece) {
		throw new Error(
			'This story has no weather piece — add a Weather element before syncing iMeteo data'
		)
	}

	const { result: settings } = await settingsMutations.read()
	const apiKey = settings?.imeteoApiKey?.trim() ?? ''
	const day = options.day ?? settings?.imeteoForecastDay

	const forecast = await fetchImeteoForecast({
		apiKey,
		day,
		fetchImpl: options.fetchImpl
	})

	const cities = mapForecastToWeatherCities(forecast)
	if (cities.length === 0) {
		throw new Error('iMeteo returned no recognisable krajské cities for the weather map')
	}

	const citiesJson = citiesToJson(cities)
	const forecastText = forecast.forecastText?.trim() ?? ''

	const { result: updatedPiece, error: pieceUpdateError } = await piecesMutations.update({
		...weatherPiece,
		payload: {
			...(weatherPiece.payload ?? {}),
			cities: citiesJson
		}
	})
	if (pieceUpdateError || !updatedPiece) {
		throw pieceUpdateError ?? new Error('Failed to update weather piece')
	}

	const { result: updatedPart, error: partUpdateError } = await partsMutations.update({
		...part,
		script: forecastText
	})
	if (partUpdateError || !updatedPart) {
		throw partUpdateError ?? new Error('Failed to update weather script')
	}

	const io = getSocketIO()
	if (io) {
		broadcastStoryDurationSync(io, partId)
	}

	try {
		await sendPartUpdateToCore(partId)
	} catch (error) {
		console.error('Weather sync: Sofie push failed (local data still saved)', error)
	}

	return {
		partId,
		pieceId: updatedPiece.id,
		date: forecast.date,
		day: forecast.day,
		forecastText,
		cities,
		citiesJson
	}
}
