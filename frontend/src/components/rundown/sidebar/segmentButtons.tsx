import { useNavigate } from '@tanstack/react-router'
import { type Dispatch, type SetStateAction } from 'react'
import { Stack } from 'react-bootstrap'
import { IconImport, IconSegment } from '~/components/icons/broadcastIcons'
import { useToasts } from '~/components/toasts/useToasts'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { addNewSegment } from '~/store/segments'
import { toolbarManifests } from '~/util/typeManifest'
import { TypeManifestEntity } from '~backend/background/interfaces'

export function SegmentButtons({
	rundownId,
	playlistId,
	rank,
	setShowImportModal,
	showImport = true
}: {
	rundownId: string
	playlistId: string | null
	rank: number
	setShowImportModal: Dispatch<SetStateAction<number | undefined>>
	showImport?: boolean
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()

	const segmentTypeManifests = useAppSelector((state) =>
		toolbarManifests(state.typeManifests.manifests, TypeManifestEntity.Segment)
	)

	const handleAddSegment = (segmentType: string, name: string) => {
		dispatch(
			addNewSegment({
				rundownId,
				playlistId,
				rank,
				segmentType,
				name,
				materializePreset: true,
				payload: { type: segmentType, name }
			})
		)
			.unwrap()
			.then(async (segment) => {
				await navigate({ to: `/rundown/${rundownId}/segment/${segment.id}` })
			})
			.catch((e) => {
				console.error(e)
				toasts.show({
					headerContent: 'Adding segment',
					bodyContent: 'Encountered an unexpected error'
				})
			})
	}

	return (
		<Stack className="segment-buttons preset-buttons" direction="horizontal" gap={1}>
			{segmentTypeManifests.map((manifest) => (
				<button
					key={manifest.id}
					className="segment-button preset-button"
					type="button"
					style={{ borderColor: manifest.colour }}
					onClick={() => handleAddSegment(manifest.id, manifest.buttonLabel ?? manifest.name)}
				>
					<span className="preset-button__icon" aria-hidden>
						<IconSegment size={12} />
					</span>
					{manifest.buttonLabel ?? manifest.name}
				</button>
			))}
			{showImport && (
				<button
					className="segment-button add-button import-button"
					type="button"
					onClick={() => setShowImportModal(rank)}
				>
					<span className="preset-button__icon" aria-hidden>
						<IconImport size={13} />
					</span>
					Import
				</button>
			)}
		</Stack>
	)
}
