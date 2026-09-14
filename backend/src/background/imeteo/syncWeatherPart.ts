import { getSocketIO } from '../socket.js'
import { mutations as partsMutations } from '../api/parts.js'
import { mutations as piecesMutations } from '../api/pieces.js'
import { mutations as settingsMutations } from '../api/settings.js'
import { sendPartUpdateToCore } from '../api/parts.js'
import { broadcastStoryDurationSync } from '../storyDurationSync.js'
import { db } from '../db.js'
import { fetchImeteoForecast } from './fetchForecast.js'
import { citiesToJson, mapForecastToWeatherCities } from './mapForecast.js'
import type { WeatherSyncResult } from './types.js'
import type { Piece } from '../interfaces.js'

function findWeatherPiece(pieces: Piece[]): Piece | undefined {
	return pieces.find((piece) => piece.pieceType === 'weather' && !piece.skip)
}

/** Serialize concurrent weather syncs per part (DB writes share one IMMEDIATE txn). */
const syncTailByPartId = new Map<string, Promise<unknown>>()

/**
 * Pull iMeteo forecast into a part that already has a `weather` piece:
 * - piece.payload.cities ← GFX-compatible JSON string
 * - part.script ← forecastText (prompter copy)
 */
export async function syncWeatherPartFromImeteo(options: {
	partId: string
	day?: string | null
	fetchImpl?: typeof fetch
	/** Test seam: defaults to Sofie `sendPartUpdateToCore`. */
	sendPartUpdate?: (partId: string) => Promise<void>
}): Promise<WeatherSyncResult> {
	const partId = options.partId?.trim()
	if (!partId) {
		throw new Error('Missing partId')
	}

	const previous = syncTailByPartId.get(partId) ?? Promise.resolve()
	const run = previous.then(() => syncWeatherPartFromImeteoLocked(partId, options))
	const tail = run.catch(() => undefined)
	syncTailByPartId.set(partId, tail)
	void tail.then(() => {
		if (syncTailByPartId.get(partId) === tail) {
			syncTailByPartId.delete(partId)
		}
	})
	return run
}

async function syncWeatherPartFromImeteoLocked(
	partId: string,
	options: {
		day?: string | null
		fetchImpl?: typeof fetch
		sendPartUpdate?: (partId: string) => Promise<void>
	}
): Promise<WeatherSyncResult> {
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

	let updatedPiece: Piece
	let updatedPartId: string

	db.exec('BEGIN IMMEDIATE')
	try {
		const { result: pieceResult, error: pieceUpdateError } = await piecesMutations.update({
			...weatherPiece,
			payload: {
				...(weatherPiece.payload ?? {}),
				cities: citiesJson
			}
		})
		if (pieceUpdateError || !pieceResult) {
			throw pieceUpdateError ?? new Error('Failed to update weather piece')
		}

		const { result: partResult, error: partUpdateError } = await partsMutations.update({
			...part,
			script: forecastText
		})
		if (partUpdateError || !partResult) {
			throw partUpdateError ?? new Error('Failed to update weather script')
		}

		updatedPiece = pieceResult
		updatedPartId = partResult.id
		db.exec('COMMIT')
	} catch (error) {
		try {
			db.exec('ROLLBACK')
		} catch {
			// ignore rollback errors when no transaction is open
		}
		throw error
	}

	// Broadcast / Sofie push only after both rows are committed.
	const io = getSocketIO()
	if (io) {
		broadcastStoryDurationSync(io, partId)
	}

	const push = options.sendPartUpdate ?? sendPartUpdateToCore
	await push(updatedPartId)

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
