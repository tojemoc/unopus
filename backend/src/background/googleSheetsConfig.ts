import fs from 'fs'
import type { ApplicationSettings } from './interfaces'
import {
	getGoogleSheetsConfigFromEnv,
	isGoogleSheetsConfigured as isGoogleSheetsConfiguredFromEnv,
	loadCredentialsFromEnv,
	type GoogleSheetsWriterConfig
} from './adapters/sheets/googleSheetsWriter'
import { mutations as settingsMutations } from './api/settings'

function parseCredentialsJson(raw: string | undefined): object | null {
	if (!raw?.trim()) {
		return null
	}
	try {
		return JSON.parse(raw) as object
	} catch {
		return null
	}
}

function loadCredentialsFromPath(filePath: string | undefined): object | null {
	if (!filePath?.trim()) {
		return null
	}
	try {
		const raw = fs.readFileSync(filePath.trim(), 'utf8')
		return parseCredentialsJson(raw)
	} catch {
		return null
	}
}

export async function getApplicationSettingsForSheets(): Promise<ApplicationSettings | undefined> {
	const { result } = await settingsMutations.read()
	return result
}

export function getGoogleSheetsConfigFromSettings(
	settings?: ApplicationSettings
): GoogleSheetsWriterConfig | null {
	const spreadsheetId = settings?.googleSheetsSpreadsheetId?.trim()
	if (!spreadsheetId) {
		return null
	}
	const startRow = Math.max(Number(settings?.googleSheetsDataStartRow) || 2, 1)
	return {
		spreadsheetId,
		sheetName: settings?.googleSheetsSheetName?.trim() || undefined,
		startRow
	}
}

export function getGoogleSheetsCredentials(
	settings?: ApplicationSettings
): object | null {
	const envVarName = settings?.googleSheetsCredentialsEnvVar?.trim()
	if (envVarName) {
		const fromNamedEnv = parseCredentialsJson(process.env[envVarName])
		if (fromNamedEnv) {
			return fromNamedEnv
		}
	}

	const fromSettingsPath = loadCredentialsFromPath(settings?.googleSheetsCredentialsPath)
	if (fromSettingsPath) {
		return fromSettingsPath
	}

	return loadCredentialsFromEnv()
}

export async function resolveGoogleSheetsConfig(): Promise<GoogleSheetsWriterConfig | null> {
	const settings = await getApplicationSettingsForSheets()
	return getGoogleSheetsConfigFromSettings(settings) ?? getGoogleSheetsConfigFromEnv()
}

export async function isGoogleSheetsConfigured(): Promise<boolean> {
	try {
		const settings = await getApplicationSettingsForSheets()
		const config =
			getGoogleSheetsConfigFromSettings(settings) ?? getGoogleSheetsConfigFromEnv()
		const credentials = getGoogleSheetsCredentials(settings)
		return Boolean(config && credentials)
	} catch {
		return isGoogleSheetsConfiguredFromEnv()
	}
}
