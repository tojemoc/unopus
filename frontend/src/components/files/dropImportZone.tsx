import { useCallback, useState } from 'react'
import { Alert } from 'react-bootstrap'
import './dropImportZone.scss'

interface DropImportZoneProps {
	label: string
	accept?: string
	onFile: (file: File) => void | Promise<void>
}

export function DropImportZone({ label, accept = '.json', onFile }: DropImportZoneProps) {
	const [dragOver, setDragOver] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	const handleFile = useCallback(
		async (file: File | undefined) => {
			if (!file) {
				return
			}
			setMessage(null)
			try {
				await onFile(file)
			} catch (e) {
				setMessage(e instanceof Error ? e.message : 'Import failed')
			}
		},
		[onFile]
	)

	return (
		<div className="drop-import-zone">
			<div
				className={`drop-import-zone__target${dragOver ? ' drop-import-zone__target--active' : ''}`}
				onDragOver={(e) => {
					e.preventDefault()
					setDragOver(true)
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={(e) => {
					e.preventDefault()
					setDragOver(false)
					void handleFile(e.dataTransfer.files[0])
				}}
			>
				<p className="mb-2">{label}</p>
				<p className="text-muted small mb-2">Drag and drop a file here, or</p>
				<label className="btn btn-outline-primary btn-sm mb-0">
					Choose file
					<input
						type="file"
						accept={accept}
						hidden
						onChange={(e) => void handleFile(e.target.files?.[0])}
					/>
				</label>
			</div>
			{message && (
				<Alert variant="danger" className="mt-2 mb-0">
					{message}
				</Alert>
			)}
		</div>
	)
}
