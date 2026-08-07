import {
	DBSettings,
	IpcOperationType,
	ApplicationSettings,
	MutationApplicationSettingsCreate,
	MutationApplicationSettingsUpdate,
	TypeManifestEntity
} from '../interfaces'
import { db } from '../db'
import { defaultRundownManifest, TYPE_MANIFESTS } from '../manifest'
import { mutations as typeManifestMutations } from './typeManifests'
import { mutations as rundownMutations } from './rundowns'
import { Server, Socket } from 'socket.io'
import { isValidHttpUrl, normalizeBaseUrl } from '../settingsResolver'
import {
	DEFAULT_DAILY_CLONE_TIMEZONE,
	isValidDailyCloneTime,
	isValidIanaTimeZone
} from '../dailyGenerationTime'

async function validateDailyTemplateSettings(
	settings: ApplicationSettings,
	{ strictTemplateId = false }: { strictTemplateId?: boolean } = {}
): Promise<{ error?: Error; normalized: ApplicationSettings }> {
	const normalized: ApplicationSettings = { ...settings }

	const trimmedTimezone = normalized.dailyCloneTimezone?.trim()
	if (!trimmedTimezone) {
		normalized.dailyCloneTimezone = DEFAULT_DAILY_CLONE_TIMEZONE
	} else if (!isValidIanaTimeZone(trimmedTimezone)) {
		return {
			error: new Error(
				`Invalid dailyCloneTimezone "${normalized.dailyCloneTimezone}" — must be a valid IANA time zone`
			),
			normalized
		}
	} else {
		normalized.dailyCloneTimezone = trimmedTimezone
	}

	if (normalized.dailyCloneTime !== undefined && normalized.dailyCloneTime !== '') {
		const trimmed = normalized.dailyCloneTime.trim()
		if (!isValidDailyCloneTime(trimmed)) {
			return {
				error: new Error(
					`Invalid dailyCloneTime "${normalized.dailyCloneTime}" — expected HH:mm (00:00–23:59)`
				),
				normalized
			}
		}
		normalized.dailyCloneTime = trimmed
	} else if (normalized.dailyCloneTime === '') {
		normalized.dailyCloneTime = undefined
	}

	const templateId = normalized.dailyTemplateRundownId?.trim()
	if (templateId) {
		const { result, error } = await rundownMutations.readOne(templateId)
		if (error || !result || !result.isTemplate) {
			if (strictTemplateId) {
				if (error || !result) {
					return {
						error: new Error(`dailyTemplateRundownId "${templateId}" does not exist`),
						normalized
					}
				}
				return {
					error: new Error(
						`dailyTemplateRundownId "${templateId}" must reference a template rundown (isTemplate=true)`
					),
					normalized
				}
			}
			normalized.dailyTemplateRundownId = undefined
		} else {
			normalized.dailyTemplateRundownId = templateId
		}
	} else {
		normalized.dailyTemplateRundownId = undefined
	}

	return { normalized }
}

export const mutations = {
	async create(
		payload: MutationApplicationSettingsCreate
	): Promise<{ result?: ApplicationSettings; error?: Error }> {
		const { error: validationError, normalized } = await validateDailyTemplateSettings(
			payload,
			{ strictTemplateId: true }
		)
		if (validationError) {
			return { error: validationError }
		}

		const document = {
			...normalized
		}

		try {
			const stmt = db.prepare(`
				INSERT INTO settings (id,document)
				VALUES ('settings',json(?));
			`)

			const result = stmt.run(JSON.stringify(document))
			if (result.changes === 0) throw new Error('No rows were inserted')

			return this.read()
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async read(): Promise<{ result?: ApplicationSettings; error?: Error }> {
		try {
			const stmt = db.prepare(`
				SELECT *
				FROM settings
				WHERE id = 'settings'
				LIMIT 1;
			`)

			const result = stmt.get() as DBSettings | undefined

			if (result) {
				const parsed = JSON.parse(result.document) as ApplicationSettings
				const { error: validationError, normalized } =
					await validateDailyTemplateSettings(parsed)
				// Non-strict: dangling template ids are cleared; only time/timezone errors surface.
				if (validationError) {
					return { error: validationError }
				}
				if (!parsed.dailyCloneTimezone && normalized.dailyCloneTimezone) {
					db.prepare(
						`
						UPDATE settings
						SET document = (SELECT json_patch(settings.document, json(?)) FROM settings WHERE id = 'settings')
						WHERE id = 'settings'
					`
					).run(JSON.stringify({ dailyCloneTimezone: normalized.dailyCloneTimezone }))
				}
				return {
					result: normalized
				}
			} else {
				return {}
			}
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async update(
		payload: MutationApplicationSettingsUpdate
	): Promise<{ result?: ApplicationSettings; error?: Error }> {
		const { result: existing } = await this.readRaw()
		const merged: ApplicationSettings = {
			...(existing ?? {}),
			...payload
		}

		const { error: validationError, normalized } = await validateDailyTemplateSettings(
			merged,
			{ strictTemplateId: true }
		)
		if (validationError) {
			return { error: validationError }
		}

		const update: ApplicationSettings = {
			...payload,
			dailyCloneTimezone: normalized.dailyCloneTimezone,
			dailyCloneTime: normalized.dailyCloneTime,
			dailyTemplateRundownId: normalized.dailyTemplateRundownId
		}

		if (update.previewBaseUrl !== undefined && update.previewBaseUrl !== '') {
			const normalizedUrl = normalizeBaseUrl(update.previewBaseUrl)
			if (!isValidHttpUrl(normalizedUrl)) {
				return { error: new Error('Preview base URL must be a valid http or https URL') }
			}
			update.previewBaseUrl = normalizedUrl
		}

		const previousTimezone =
			existing?.dailyCloneTimezone?.trim() || DEFAULT_DAILY_CLONE_TIMEZONE
		const nextTimezone = normalized.dailyCloneTimezone?.trim() || DEFAULT_DAILY_CLONE_TIMEZONE
		const templateId =
			normalized.dailyTemplateRundownId?.trim() || existing?.dailyTemplateRundownId?.trim()

		try {
			const stmt = db.prepare(`
				UPDATE settings
				SET document = (SELECT json_patch(settings.document, json(?)) FROM settings WHERE id = 'settings')
				WHERE id = 'settings';
			`)

			// json_patch cannot remove keys with undefined — encode clears as JSON null then strip.
			const patch: Record<string, unknown> = { ...update }
			for (const key of [
				'dailyTemplateRundownId',
				'dailyCloneTime',
				'dailyCloneTimezone'
			] as const) {
				if (key in payload && (payload[key] === undefined || payload[key] === '')) {
					patch[key] = null
				}
			}

			stmt.run(JSON.stringify(patch))

			if (templateId && previousTimezone !== nextTimezone) {
				const { reconcileForeignTimezoneInProgress } = await import('./dailyGeneration')
				reconcileForeignTimezoneInProgress(templateId, nextTimezone)
			}

			return this.read()
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	/** Raw read without validation (avoids recursion from validated read). */
	async readRaw(): Promise<{ result?: ApplicationSettings; error?: Error }> {
		try {
			const stmt = db.prepare(`
				SELECT *
				FROM settings
				WHERE id = 'settings'
				LIMIT 1;
			`)

			const result = stmt.get() as DBSettings | undefined
			if (result) {
				return { result: JSON.parse(result.document) as ApplicationSettings }
			}
			return {}
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async reset(): Promise<{ result?: ApplicationSettings; error?: Error }> {
		await resetTypeManifestsToDefaults()

		return await this.read()
	},
	async reloadManifestsFromAssets(
		options?: ReloadTypeManifestsOptions
	): Promise<{ result?: ApplicationSettings; error?: Error }> {
		await upsertTypeManifestsFromAssets(options)
		return await this.read()
	}
}

export interface ReloadTypeManifestsOptions {
	/** When true, delete piece/part/segment types that are not present in /assets/ */
	removeOrphans?: boolean
}

export function registerSettingsHandlers(socket: Socket, _io: Server) {
	socket.on('settings', async (action, payload, callback) => {
		switch (action) {
			case IpcOperationType.Create:
				{
					const { result, error } = await mutations.create(payload)
					callback(result || error)
				}
				break
			case IpcOperationType.Read:
				{
					const { result, error } = await mutations.read()
					callback(result || error)
				}
				break
			case IpcOperationType.Update:
				{
					const { result, error } = await mutations.update(payload)
					callback(result || error)
				}
				break
			case 'reset':
				{
					const { result, error } = await mutations.reset()
					callback(result || error)
				}
				break
			case 'reloadManifests':
				{
					const { result, error } = await mutations.reloadManifestsFromAssets(
						payload as ReloadTypeManifestsOptions | undefined
					)
					callback(result || error)
				}
				break
			default:
				callback(new Error(`Unknown operation type ${action}`))
		}
	})
}

const DEFAULT_SETTINGS: ApplicationSettings = {
	coreUrl: '127.0.0.1',
	corePort: 3000,
	dailyCloneTimezone: DEFAULT_DAILY_CLONE_TIMEZONE
}

async function deleteAllTypeManifests(): Promise<void> {
	const { result } = await typeManifestMutations.read({})
	if (!Array.isArray(result)) return

	for (const manifest of result) {
		await typeManifestMutations.delete({ id: manifest.id, entityType: manifest.entityType })
	}
}

async function seedDefaultTypeManifests(): Promise<void> {
	const { error: rundownError } = await typeManifestMutations.create({
		id: 'rundown',
		entityType: TypeManifestEntity.Rundown,
		payload: defaultRundownManifest.payload
	})
	if (rundownError) {
		console.error('Failed to seed rundown typeManifest:', rundownError)
		throw rundownError
	}

	for (const typeManifest of TYPE_MANIFESTS) {
		const { error } = await typeManifestMutations.create(typeManifest)
		if (error) {
			console.error(
				`Failed to seed typeManifest ${typeManifest.entityType}/${typeManifest.id}:`,
				error
			)
			throw error
		}
	}
}

async function upsertTypeManifestsFromAssets(
	options?: ReloadTypeManifestsOptions
): Promise<void> {
	const { result: existingManifests } = await typeManifestMutations.read({})
	const existingList = Array.isArray(existingManifests) ? existingManifests : []
	const existingKeys = new Set(
		existingList.map((manifest) => `${manifest.entityType}:${manifest.id}`)
	)

	const assetKeys = new Set<string>([
		`${TypeManifestEntity.Rundown}:${defaultRundownManifest.id}`,
		...TYPE_MANIFESTS.map((manifest) => `${manifest.entityType}:${manifest.id}`)
	])

	const rundownKey = `${TypeManifestEntity.Rundown}:${defaultRundownManifest.id}`
	if (existingKeys.has(rundownKey)) {
		const { error: rundownUpdateError } = await typeManifestMutations.update({
			id: defaultRundownManifest.id,
			entityType: TypeManifestEntity.Rundown,
			update: defaultRundownManifest
		})
		if (rundownUpdateError) {
			console.error('Failed to update rundown typeManifest:', rundownUpdateError)
			throw rundownUpdateError
		}
	} else {
		const { error: rundownCreateError } = await typeManifestMutations.create({
			id: defaultRundownManifest.id,
			entityType: TypeManifestEntity.Rundown,
			payload: defaultRundownManifest.payload
		})
		if (rundownCreateError) {
			console.error('Failed to create rundown typeManifest:', rundownCreateError)
			throw rundownCreateError
		}
	}

	for (const typeManifest of TYPE_MANIFESTS) {
		const key = `${typeManifest.entityType}:${typeManifest.id}`
		if (existingKeys.has(key)) {
			const { error } = await typeManifestMutations.update({
				id: typeManifest.id,
				entityType: typeManifest.entityType,
				update: typeManifest
			})
			if (error) {
				console.error(`Failed to update typeManifest ${key}:`, error)
				throw error
			}
		} else {
			const { error } = await typeManifestMutations.create(typeManifest)
			if (error) {
				console.error(`Failed to create typeManifest ${key}:`, error)
				throw error
			}
		}
	}

	if (options?.removeOrphans) {
		for (const existing of existingList) {
			const key = `${existing.entityType}:${existing.id}`
			if (assetKeys.has(key)) continue
			const { error } = await typeManifestMutations.delete({
				id: existing.id,
				entityType: existing.entityType
			})
			if (error) {
				console.error(`Failed to delete orphan typeManifest ${key}:`, error)
				throw error
			}
		}
	}
}

async function resetTypeManifestsToDefaults(): Promise<void> {
	await deleteAllTypeManifests()
	await seedDefaultTypeManifests()
}

export async function initializeDefaults() {
	const { result: settings } = await mutations.readRaw()
	if (!settings) {
		await mutations.create(DEFAULT_SETTINGS)
	}

	const { result: existingManifests } = await typeManifestMutations.read({})
	if (Array.isArray(existingManifests) && existingManifests.length > 0) {
		return
	}

	await seedDefaultTypeManifests()
}
