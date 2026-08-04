import { Accordion, Button, ButtonGroup, Modal } from 'react-bootstrap'
import { useState } from 'react'
import { useAppDispatch } from '~/store/app'
import {
	addNewTypeManifest,
	importTypeManifest,
	removeTypeManifestsByEntityType,
	updateTypeManifest
} from '~/store/typeManifest'
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
	const [showDeleteAll, setShowDeleteAll] = useState(false)
	const [deletingAll, setDeletingAll] = useState(false)

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

	const deleteAll = async () => {
		setDeletingAll(true)
		try {
			await dispatch(removeTypeManifestsByEntityType({ entityType })).unwrap()
			setShowDeleteAll(false)
			toasts.show({
				headerContent: `Delete ${title}`,
				bodyContent: `Removed ${typeManifests.length} type${typeManifests.length === 1 ? '' : 's'}`
			})
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: `Delete ${title}`,
				bodyContent: e instanceof Error ? e.message : 'Delete failed'
			})
		} finally {
			setDeletingAll(false)
		}
	}

	return (
		<>
			<h2>
				{title}
				<ButtonGroup className="float-end">
					<Button
						size="sm"
						variant="outline-danger"
						disabled={typeManifests.length === 0}
						onClick={() => setShowDeleteAll(true)}
					>
						Delete all
					</Button>
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

			<Modal show={showDeleteAll} onHide={() => setShowDeleteAll(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Delete all {title.toLowerCase()}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					Delete all {typeManifests.length} {title.toLowerCase()}? This cannot be undone.
					<br />
					<br />
					Tip: to replace with bundled definitions, use{' '}
					<strong>Settings → Connection → Reload type manifests from assets</strong> instead
					(optionally with “Remove types not in assets”).
				</Modal.Body>
				<Modal.Footer>
					<Button
						variant="secondary"
						onClick={() => setShowDeleteAll(false)}
						disabled={deletingAll}
					>
						Cancel
					</Button>
					<Button variant="danger" onClick={() => void deleteAll()} disabled={deletingAll}>
						{deletingAll ? 'Deleting…' : 'Delete all'}
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	)
}
