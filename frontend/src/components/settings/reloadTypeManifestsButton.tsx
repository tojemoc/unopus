import { Button, Form, Modal } from 'react-bootstrap'
import { useState } from 'react'
import { ipcAPI } from '~/lib/IPC'
import { useToasts } from '../toasts/useToasts'

export function ReloadTypeManifestsButton() {
	const [showConfirm, setShowConfirm] = useState(false)
	const [loading, setLoading] = useState(false)
	const [removeOrphans, setRemoveOrphans] = useState(false)
	const toasts = useToasts()

	const performReload = async () => {
		if (loading) return
		setLoading(true)
		try {
			await ipcAPI.reloadTypeManifests({ removeOrphans })
			setShowConfirm(false)
			toasts.show({
				headerContent: 'Type manifests reloaded',
				bodyContent: removeOrphans
					? 'Types from /assets/ were fully replaced by entity type and id; extras not in assets were removed.'
					: 'Types from /assets/ were fully replaced by entity type and id; custom extras were kept.'
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
			<Button
				onClick={() => setShowConfirm(true)}
				variant="outline-secondary"
				className="me-2"
				disabled={loading}
			>
				Reload type manifests from assets
			</Button>

			<Modal show={showConfirm} onHide={() => setShowConfirm(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Reload type manifests</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<p>
						Fully replace piece, part, and segment type definitions from <code>/assets/</code> by
						entity type and id. You do <strong>not</strong> need to delete types one-by-one first —
						matching entity type + id pairs are overwritten completely (including removed fields).
					</p>
					<Form.Check
						type="checkbox"
						id="remove-orphan-types"
						label="Also remove types not present in assets"
						checked={removeOrphans}
						onChange={(e) => setRemoveOrphans(e.target.checked)}
					/>
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
