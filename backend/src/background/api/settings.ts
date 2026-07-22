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
import { Server, Socket } from 'socket.io'
import { isValidHttpUrl, normalizeBaseUrl } from '../settingsResolver'

export const mutations = {
	async create(
		payload: MutationApplicationSettingsCreate
	): Promise<{ result?: ApplicationSettings; error?: Error }> {
		const document = {
			...payload
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
				return {
					result: {
						...JSON.parse(result.document)
					}
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
		const update = {
			...payload
		}

		if (update.previewBaseUrl !== undefined && update.previewBaseUrl !== '') {
			const normalized = normalizeBaseUrl(update.previewBaseUrl)
			if (!isValidHttpUrl(normalized)) {
				return { error: new Error('Preview base URL must be a valid http or https URL') }
			}
			update.previewBaseUrl = normalized
		}

		try {
			const stmt = db.prepare(`
				UPDATE settings
				SET document = (SELECT json_patch(settings.document, json(?)) FROM settings WHERE id = 'settings')
				WHERE id = 'settings';
			`)

			stmt.run(JSON.stringify(update))

			return this.read()
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},
	async reset(): Promise<{ result?: ApplicationSettings; error?: Error }> {
		await resetTypeManifestsToDefaults()

		return await this.read()
	},
	async reloadManifestsFromAssets(): Promise<{ result?: ApplicationSettings; error?: Error }> {
		await upsertTypeManifestsFromAssets()
		return await this.read()
	}
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
					const { result, error } = await mutations.reloadManifestsFromAssets()
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
	corePort: 3000
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
			console.error(`Failed to seed typeManifest ${typeManifest.entityType}/${typeManifest.id}:`, error)
			throw error
		}
	}
}

async function upsertTypeManifestsFromAssets(): Promise<void> {
	const { result: existingManifests } = await typeManifestMutations.read({})
	const existingList = Array.isArray(existingManifests) ? existingManifests : []
	const existingKeys = new Set(existingList.map((manifest) => `${manifest.entityType}:${manifest.id}`))

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
}

async function resetTypeManifestsToDefaults(): Promise<void> {
	await deleteAllTypeManifests()
	await seedDefaultTypeManifests()
}

export async function initializeDefaults() {
	const { result: settings } = await mutations.read()
	if (!settings) {
		await mutations.create(DEFAULT_SETTINGS)
	}

	const { result: existingManifests } = await typeManifestMutations.read({})
	if (Array.isArray(existingManifests) && existingManifests.length > 0) {
		return
	}

	await seedDefaultTypeManifests()
}
