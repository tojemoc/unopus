/**
 * iMeteo.sk Partner API (FORECAST) response shapes — camelCase as documented
 * in the 360tka partner PDF (v1.0 REST JSON).
 */

export type ImeteoForecastDay = 'today' | 'tomorrow' | string

export interface ImeteoStatus {
	name: string
	icon: string
}

export interface ImeteoCity {
	name: string
	tempMin: number
	tempMax: number
	temp: number
	status: ImeteoStatus
}

export interface ImeteoSlovakia {
	tempMin: number
	tempMax: number
	status: ImeteoStatus
}

export interface ImeteoForecastResponse {
	date: string
	day: string
	forecastText: string
	slovakia: ImeteoSlovakia
	cities: ImeteoCity[]
}

/** City row stored in weather piece `cities` JSON (Caspar/GFX contract). */
export interface WeatherCityPayload {
	region: string
	name: string
	temp: string
	/** Icon stem for gfx/pocasie (`../icons/<image>.svg`). */
	image: string
	/** Human-readable status; blueprints prefer `image` for template data. */
	condition?: string
	delay: number
}

export interface WeatherSyncResult {
	partId: string
	pieceId: string
	date: string
	day: string
	forecastText: string
	cities: WeatherCityPayload[]
	citiesJson: string
}
