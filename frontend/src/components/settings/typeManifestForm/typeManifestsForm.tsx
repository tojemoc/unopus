import { Accordion, Button, ButtonGroup } from 'react-bootstrap'
import { useAppDispatch } from '~/store/app'
import { addNewTypeManifest, importTypeManifest, updateTypeManifest } from '~/store/typeManifest'
import { ipcAPI } from '~/lib/IPC'
import { TypeManifestEntity } from '~backend/background/interfaces'
import type { TypeManifest } from '~backend/background/interfaces'
import './typesForm.scss'
import { useToasts } from '~/components/toasts/useToasts'
import { TypeManifestForm } from './typeManifestForm'
import { DropImportZone } from '~/components/files/dropImportZone'

export function TypeManifestsForm({
	typeManifests,
	entityType,
	title
}: {
	typeManifests: TypeManifest[]
	entityType: TypeManifestEntity
	title: string
}) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()

	// Add new type
	const addType = () => {
		dispatch(addNewTypeManifest(entityType)).catch((e) => {
			console.error(e)
			toasts.show({ headerContent: `Adding ${title}`, bodyContent: 'Unexpected error' })
		})
	}

	// Export types
	const exportTypes = () => {
		ipcAPI.saveToFile({ title: `Export ${title}`, document: typeManifests }).catch(console.error)
	}

	const importFromData = async (imported: unknown) => {
		const verify = (arr: unknown): arr is TypeManifest[] =>
			Array.isArray(arr) &&
			arr.every(
				(t) =>
					typeof t === 'object' &&
					t !== null &&
					'id' in t &&
					'entityType' in t &&
					'name' in t &&
					'payload' in t
			)

		if (!verify(imported)) {
			toasts.show({ headerContent: `Import ${title}`, bodyContent: 'Invalid file' })
			return
		}

		await Promise.all(
			imported.map(async (t) => {
				const existing = typeManifests.find((m) => m.id === t.id)
				if (existing) {
					await dispatch(updateTypeManifest({ originalId: existing.id, typeManifest: t }))
				} else {
					await dispatch(importTypeManifest({ typeManifest: t }))
				}
			})
		)

		toasts.show({
			headerContent: `Import ${title}`,
			bodyContent: `Imported ${imported.length} item${imported.length === 1 ? '' : 's'}`
		})
	}

	const importTypes = async () => {
		try {
			const imported = await ipcAPI.openFromFile({ title: `Import ${title}` })
			await importFromData(imported)
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: `Import ${title}`,
				bodyContent: e instanceof Error ? e.message : 'Import failed'
			})
		}
	}

	const importFile = async (file: File) => {
		const text = await file.text()
		const imported = JSON.parse(text) as unknown
		await importFromData(imported)
	}

	return (
		<>
			<h2>
				{title}
				<ButtonGroup className="float-end">
					<Button size="sm" variant="secondary" onClick={() => void importTypes()}>
						Import
					</Button>
					<Button size="sm" variant="secondary" onClick={exportTypes}>
						Export
					</Button>
					<Button size="sm" onClick={addType}>
						+ Add type
					</Button>
				</ButtonGroup>
			</h2>

			<div className="mb-3">
				<DropImportZone label={`Import ${title} from JSON`} onFile={importFile} />
			</div>

			<Accordion alwaysOpen className="settings-types">
				{typeManifests.length === 0
					? 'No types found, create or import types!'
					: typeManifests.map((manifest) => (
							<Accordion.Item eventKey={manifest.id} key={manifest.id}>
								<Accordion.Header>
									<div
										className="colour-preview me-2"
										style={{ backgroundColor: manifest.colour }}
									/>
									{manifest.name}
								</Accordion.Header>
								<Accordion.Body>
									<TypeManifestForm manifest={manifest} />
								</Accordion.Body>
							</Accordion.Item>
						))}
			</Accordion>
		</>
	)
}
