import { Modal } from 'react-bootstrap'
import type { Rundown } from '~backend/background/interfaces'
import { RundownPropertiesForm } from './rundownPropertiesForm'

interface RundownPropertiesModalProps {
	rundown: Rundown
	show: boolean
	onHide: () => void
}

export function RundownPropertiesModal({ rundown, show, onHide }: RundownPropertiesModalProps) {
	return (
		<Modal show={show} onHide={onHide} size="lg" className="re-modal-surface">
			<Modal.Header closeButton>
				<Modal.Title>Rundown settings</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<RundownPropertiesForm rundown={rundown} />
			</Modal.Body>
		</Modal>
	)
}
