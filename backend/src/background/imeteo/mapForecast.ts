import type {
	ImeteoCity,
	ImeteoForecastResponse,
	WeatherCityPayload
} from './types.js'

/** Official krajské-mesto order and Caspar region codes (gfx/pocasie cards). */
export const CITY_NAME_TO_REGION: ReadonlyArray<{
	match: RegExp
	region: string
	displayName: string
	delay: number
}> = [
	{ match: /^bratislava$/i, region: 'BA', displayName: 'BRATISLAVA', delay: 200 },
	{ match: /^trnava$/i, region: 'TT', displayName: 'TRNAVA', delay: 400 },
	{ match: /^nitra$/i, region: 'NR', displayName: 'NITRA', delay: 600 },
	{ match: /^tren(?:č|c)ín$/i, region: 'TN', displayName: 'TRENČÍN', delay: 800 },
	{ match: /^žilina$|^zilina$/i, region: 'ZA', displayName: 'ŽILINA', delay: 1000 },
	{
		match: /^banská\s+bystrica$|^banska\s+bystrica$|^b\.\s*bystrica$/i,
		region: 'BB',
		displayName: 'B. BYSTRICA',
		delay: 1200
	},
	{ match: /^košice$|^kosice$/i, region: 'KE', displayName: 'KOŠICE', delay: 1400 },
	{ match: /^prešov$|^presov$/i, region: 'PO', displayName: 'PREŠOV', delay: 1600 }
]

/**
 * Map iMeteo `status.icon` → demo-assets `template/icons/<name>.svg` stems.
 * Available SVGs today: sunny, partly-cloudy, cloudy, rain, snow.
 */
export const IMETEO_ICON_TO_GFX: Readonly<Record<string, string>> = {
	sunny: 'sunny',
	'mostly-cloudy': 'partly-cloudy',
	cloudy: 'cloudy',
	overcast: 'cloudy',
	'showers-sunny': 'rain',
	showers: 'rain',
	rain: 'rain',
	'heavy-rain': 'rain',
	storm: 'rain',
	'snow-showers': 'snow',
	snow: 'snow',
	'heavy-snow': 'snow',
	'freezing-rain': 'rain'
}

const DEFAULT_GFX_ICON = 'cloudy'

export function mapImeteoIconToGfx(icon: string | undefined | null): string {
	const key = String(icon ?? '')
		.trim()
		.toLowerCase()
	if (!key) return DEFAULT_GFX_ICON
	return IMETEO_ICON_TO_GFX[key] ?? DEFAULT_GFX_ICON
}

function resolveCityMeta(name: string): (typeof CITY_NAME_TO_REGION)[number] | undefined {
	const trimmed = name.trim()
	return CITY_NAME_TO_REGION.find((entry) => entry.match.test(trimmed))
}

/**
 * Prefer day max (PDF: hlavná teplota na mape); fall back to representative `temp`.
 */
export function pickDisplayTemp(city: Pick<ImeteoCity, 'temp' | 'tempMax'>): string {
	const raw = city.tempMax ?? city.temp
	if (raw === undefined || raw === null || Number.isNaN(Number(raw))) {
		return '0'
	}
	return String(raw)
}

export function mapCityToWeatherPayload(city: ImeteoCity): WeatherCityPayload | undefined {
	const meta = resolveCityMeta(city.name)
	if (!meta) return undefined

	const icon = city.status?.icon
	const image = mapImeteoIconToGfx(icon)
	const condition =
		typeof city.status?.name === 'string' && city.status.name.trim()
			? city.status.name.trim()
			: image

	return {
		region: meta.region,
		name: meta.displayName,
		temp: pickDisplayTemp(city),
		image,
		condition,
		delay: meta.delay
	}
}

/**
 * Build the weather piece `cities` array in Caspar card order (BA…PO).
 * Unknown city names from the API are skipped; missing regions leave gaps
 * (template falls back to its built-in defaults for those cards).
 */
export function mapForecastToWeatherCities(
	forecast: ImeteoForecastResponse
): WeatherCityPayload[] {
	const byRegion = new Map<string, WeatherCityPayload>()
	for (const city of forecast.cities ?? []) {
		const row = mapCityToWeatherPayload(city)
		if (row) byRegion.set(row.region, row)
	}

	return CITY_NAME_TO_REGION.map((meta) => byRegion.get(meta.region)).filter(
		(row): row is WeatherCityPayload => Boolean(row)
	)
}

export function citiesToJson(cities: WeatherCityPayload[]): string {
	return JSON.stringify(cities)
}
