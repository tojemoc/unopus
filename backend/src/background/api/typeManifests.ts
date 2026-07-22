import {
	DBTypeManifest,
	IpcOperationType,
	MutationTypeManifestCreate,
	MutationTypeManifestDelete,
	MutationTypeManifestRead,
	MutationTypeManifestUpdate,
	TypeManifest,
	TypeManifestEntity
} from '../interfaces'
import { db } from '../db'
import { v4 as uuid } from 'uuid'
import { Server, Socket } from 'socket.io'

export function resolveManifestId(
	requestedId: string,
	manifests: TypeManifest[]
): string | undefined {
	const exact = manifests.find((m) => m.id === requestedId)
	if (exact) return exact.id

	const normalized = requestedId.toLowerCase()
	return manifests.find((m) => m.id.toLowerCase() === normalized)?.id
}

function mapRow(document: DBTypeManifest): TypeManifest {
	return {
		...JSON.parse(document.document),
		id: document.id,
		entityType: document.entityType
	}
}

export const mutations = {
	async create(
		payload: MutationTypeManifestCreate
	): Promise<{ result?: TypeManifest; error?: Error }> {
		const id = payload.id || uuid()
		const document: Partial<MutationTypeManifestCreate> = { ...payload, id }

		try {
			const stmt = db.prepare(`
				INSERT INTO typeManifests (id, document, entityType)
				VALUES (?, json(?), ?);
			`)

			const result = stmt.run(id, JSON.stringify(document), payload.entityType)
			if (result.changes === 0) throw new Error('No rows were inserted')

			return this.readOne(id, payload.entityType)
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},

	async readOne(
		id: string,
		entityType: TypeManifestEntity
	): Promise<{ result?: TypeManifest; error?: Error }> {
		try {
			const stmt = db.prepare(`
				SELECT *
				FROM typeManifests
				WHERE id = ? AND entityType = ?
				LIMIT 1;
			`)

			const document = stmt.get(id, entityType) as DBTypeManifest | undefined
			if (!document) {
				return { error: new Error(`TypeManifest with id ${id} (${entityType}) not found`) }
			}

			return { result: mapRow(document) }
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},

	async read(
		payload: Partial<MutationTypeManifestRead>
	): Promise<{ result?: TypeManifest | TypeManifest[]; error?: Error }> {
		if (payload && payload.id && payload.entityType) {
			return this.readOne(payload.id, payload.entityType)
		} else if (payload && payload.entityType) {
			try {
				const stmt = db.prepare(`
					SELECT *
					FROM typeManifests
					WHERE entityType = ?
				`)

				const documents = stmt.all(payload.entityType) as unknown as DBTypeManifest[]

				return {
					result: documents.map(mapRow)
				}
			} catch (e) {
				console.error(e)
				return { error: e as Error }
			}
		} else {
			try {
				const stmt = db.prepare(`
					SELECT *
					FROM typeManifests
				`)

				const documents = stmt.all() as unknown as DBTypeManifest[]

				return {
					result: documents.map(mapRow)
				}
			} catch (e) {
				console.error(e)
				return { error: e as Error }
			}
		}
	},

	async update(
		payload: MutationTypeManifestUpdate
	): Promise<{ result?: TypeManifest; error?: Error }> {
		const update = { ...payload.update }
		const entityType = payload.entityType ?? update.entityType
		if (!entityType) {
			return { error: new Error('Missing entityType for typeManifest update') }
		}

		try {
			const stmt = db.prepare(`
			UPDATE typeManifests
			SET document = json_patch(document, json(?))
			WHERE id = ? AND entityType = ?;
		`)

			const result = stmt.run(JSON.stringify(update), payload.id, entityType)
			if (result.changes === 0) throw new Error('No rows were updated')

			return this.readOne(payload.update.id ?? payload.id, entityType)
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	},

	async delete(payload: MutationTypeManifestDelete): Promise<{ error?: Error }> {
		try {
			const stmt = db.prepare(`
				DELETE FROM typeManifests
				WHERE id = ? AND entityType = ?;
			`)

			stmt.run(payload.id, payload.entityType)
			return {}
		} catch (e) {
			console.error(e)
			return { error: e as Error }
		}
	}
}

export function registerTypeManifestsHandlers(socket: Socket, _io: Server) {
	socket.on('typeManifests', async (action, payload, callback) => {
		switch (action) {
			case IpcOperationType.Create:
				{
					const { result, error } = await mutations.create(payload)
					callback(result || error)
				}
				break
			case IpcOperationType.Read:
				{
					const { result, error } = await mutations.read(payload)
					callback(result || error)
				}
				break
			case IpcOperationType.Update:
				{
					const { result, error } = await mutations.update(payload)
					callback(result || error)
				}
				break
			case IpcOperationType.Delete:
				{
					const { error } = await mutations.delete(payload)
					callback(error || true)
				}
				break
			default:
				callback(new Error(`Unknown operation type ${action}`))
		}
	})
}
