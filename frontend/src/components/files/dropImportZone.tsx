import { useCallback, useRef, useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import './dropImportZone.scss'

interface DropImportZoneProps {
	label: string
	accept?: string
	onFile: (file: File) => void | Promise<void>
}

export function DropImportZone({ label, accept = '.json', onFile }: DropImportZoneProps) {
	const inputRef = useRef<HTMLInputElement>(null)
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
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				hidden
				onChange={(e) => void handleFile(e.target.files?.[0])}
			/>
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
				<Button
					type="button"
					variant="outline-primary"
					size="sm"
					aria-label="Choose file to import"
					onClick={() => inputRef.current?.click()}
				>
					Choose file
				</Button>
			</div>
			{message && (
				<Alert variant="danger" className="mt-2 mb-0">
					{message}
				</Alert>
			)}
		</div>
	)
}
