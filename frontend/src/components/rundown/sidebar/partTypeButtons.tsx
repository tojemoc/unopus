import { useNavigate } from '@tanstack/react-router'
import { Stack } from 'react-bootstrap'
import { useToasts } from '~/components/toasts/useToasts'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { addNewPart } from '~/store/parts'
import { findTypeManifest, toolbarManifests } from '~/util/typeManifest'
import type { Segment } from '~backend/background/interfaces'
import { TypeManifestEntity } from '~backend/background/interfaces'

type PartTypeButtonsProps =
	| {
			disabled?: false
			segment: Segment
			rank: number
			insertHint?: string
			disabledReason?: never
	  }
	| {
			disabled: true
			segment?: never
			rank?: never
			insertHint?: never
			disabledReason?: string
	  }

export function PartTypeButtons(props: PartTypeButtonsProps) {
	const { disabled = false, disabledReason, insertHint } = props

	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()

	const partTypeManifests = useAppSelector((state) =>
		toolbarManifests(state.typeManifests.manifests, TypeManifestEntity.Part)
	)
	const allManifests = useAppSelector((state) => state.typeManifests.manifests)

	const handleAddPart = (partType: string) => {
		if (props.disabled) {
			return
		}

		const { segment, rank: insertRank } = props
		const manifest = findTypeManifest(allManifests, partType, TypeManifestEntity.Part)
		const name = manifest?.buttonLabel ?? manifest?.name ?? `Part ${insertRank + 1}`

		dispatch(
			addNewPart({
				rundownId: segment.rundownId,
				playlistId: segment.playlistId,
				segmentId: segment.id,
				rank: insertRank,
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

	const toolbarTitle = disabled
		? (disabledReason ?? 'Open a story to add a part')
		: insertHint
			? `Add story ${insertHint}`
			: undefined

	return (
		<Stack
			className="part-type-buttons preset-buttons"
			direction="horizontal"
			gap={1}
			title={toolbarTitle}
			aria-label={toolbarTitle}
		>
			{partTypeManifests.map((manifest) => (
				<button
					key={manifest.id}
					className="part-button preset-button"
					type="button"
					style={{ borderColor: manifest.colour }}
					disabled={disabled}
					title={
						disabled
							? disabledReason
							: insertHint
								? `Add ${manifest.buttonLabel ?? manifest.shortName ?? manifest.name} ${insertHint}`
								: undefined
					}
					onClick={() => handleAddPart(manifest.id)}
				>
					{manifest.buttonLabel ?? manifest.shortName ?? manifest.name}
				</button>
			))}
		</Stack>
	)
}
