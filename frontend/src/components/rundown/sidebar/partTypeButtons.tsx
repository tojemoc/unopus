import { useNavigate } from '@tanstack/react-router'
import { Stack } from 'react-bootstrap'
import { useToasts } from '~/components/toasts/useToasts'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { addNewPart } from '~/store/parts'
import { findTypeManifest, toolbarManifests } from '~/util/typeManifest'
import type { Segment } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'

export function PartTypeButtons({
	segment,
	rank
}: {
	segment: Segment
	rank: number
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()

	const partTypeManifests = useAppSelector((state) =>
		toolbarManifests(state.typeManifests.manifests, TypeManifestEntity.Part)
	)
	const allManifests = useAppSelector((state) => state.typeManifests.manifests)

	const handleAddPart = (partType: string) => {
		const manifest = findTypeManifest(allManifests, partType)
		const name = manifest?.buttonLabel ?? manifest?.name ?? `Part ${rank + 1}`

		dispatch(
			addNewPart({
				rundownId: segment.rundownId,
				playlistId: segment.playlistId,
				segmentId: segment.id,
				rank,
				partType,
				name,
				fromPreset: true
			})
		)
			.unwrap()
			.then((part) =>
				navigate({
					to: `/rundown/${segment.rundownId}/segment/${segment.id}/part/${part.id}`
				})
			)
			.catch(() =>
				toasts.show({
					headerContent: 'Adding part',
					bodyContent: 'Encountered an unexpected error'
				})
			)
	}

	return (
		<Stack className="part-type-buttons preset-buttons" direction="horizontal" gap={1}>
			{partTypeManifests.map((manifest) => (
				<button
					key={manifest.id}
					className="part-button preset-button"
					type="button"
					style={{ borderColor: manifest.colour }}
					onClick={() => handleAddPart(manifest.id)}
				>
					{manifest.buttonLabel ?? manifest.shortName ?? manifest.name}
				</button>
			))}
		</Stack>
	)
}
