import { Button, Modal } from 'react-bootstrap'
import { useState } from 'react'
import { ipcAPI } from '~/lib/IPC'

export function ResetToDefaults() {
	const [showDelete, setShowDelete] = useState(false)
	const handleDeleteClose = () => setShowDelete(false)

	const deletePart = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		setShowDelete(true)
	}
	const performDeletePart = () => {
		ipcAPI
			.resetSettings()
			.then(() => {
				console.log('reset settings')
				window.location.reload()
			})
			.catch((e) => {
				console.error('Error resetting settings:', e)
			})
	}

	return (
		<>
			<Button onClick={deletePart} variant="warning">
				Reset to defaults
			</Button>

			<Modal show={showDelete} onHide={handleDeleteClose}>
				<Modal.Header closeButton>
					<Modal.Title>Reset to defaults</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					Are you sure you want to wipe all piece/part/segment types and reseed them from{' '}
					<code>/assets/</code>? Connection settings are kept. This cannot be undone.
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={handleDeleteClose}>
						Cancel
					</Button>
					<Button variant="danger" onClick={performDeletePart}>
						Reset
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	)
}
