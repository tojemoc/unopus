import { Button, Modal } from 'react-bootstrap'
import { useState } from 'react'
import { ipcAPI } from '~/lib/IPC'
import { useToasts } from '../toasts/useToasts'

export function ReloadTypeManifestsButton() {
	const [showConfirm, setShowConfirm] = useState(false)
	const [loading, setLoading] = useState(false)
	const toasts = useToasts()

	const performReload = async () => {
		setLoading(true)
		try {
			await ipcAPI.reloadTypeManifests()
			setShowConfirm(false)
			toasts.show({
				headerContent: 'Type manifests reloaded',
				bodyContent: 'Piece, part, and segment types from /assets/ were upserted by id.'
			})
			window.location.reload()
		} catch (error) {
			console.error('Error reloading type manifests:', error)
			toasts.show({
				headerContent: 'Reload failed',
				bodyContent: (error as Error).message
			})
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			<Button onClick={() => setShowConfirm(true)} variant="outline-secondary" className="me-2">
				Reload type manifests from assets
			</Button>

			<Modal show={showConfirm} onHide={() => setShowConfirm(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Reload type manifests</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					Upsert piece, part, and segment type definitions from <code>/assets/</code> by id.
					Custom types you added are kept; built-in types are updated to match the bundled
					manifests.
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={loading}>
						Cancel
					</Button>
					<Button variant="primary" onClick={() => void performReload()} disabled={loading}>
						{loading ? 'Reloading…' : 'Reload'}
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	)
}
