import { useNavigate } from '@tanstack/react-router'
import { Stack } from 'react-bootstrap'
import { IconPlus, PartTypeIcon } from '~/components/icons/broadcastIcons'
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

	const handleAddPart = (opts: { partType: string; name: string; fromPreset: boolean }) => {
		if (props.disabled) {
			return
		}

		const { segment, rank: insertRank } = props

		dispatch(
			addNewPart({
				rundownId: segment.rundownId,
				playlistId: segment.playlistId,
				segmentId: segment.id,
				rank: insertRank,
				partType: opts.partType,
				name: opts.name,
				fromPreset: opts.fromPreset
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
			<button
				className="part-button add-button empty-part-button"
				type="button"
				disabled={disabled}
				title={
					disabled
						? disabledReason
						: insertHint
							? `Add empty part ${insertHint}`
							: 'Add empty part'
				}
				onClick={() =>
					handleAddPart({
						partType: '',
						name: props.disabled ? 'Part' : `Part ${props.rank + 1}`,
						fromPreset: false
					})
				}
			>
				<span className="preset-button__icon" aria-hidden>
					<IconPlus size={12} />
				</span>
				Empty
			</button>
			{partTypeManifests.map((manifest) => (
				<button
					key={manifest.id}
					className="part-button preset-button"
					type="button"
					style={{
						borderColor: manifest.colour,
						backgroundColor: manifest.colour,
						color: 'var(--re-text-on-chip)'
					}}
					disabled={disabled}
					title={
						disabled
							? disabledReason
							: insertHint
								? `Add ${manifest.buttonLabel ?? manifest.shortName ?? manifest.name} ${insertHint}`
								: undefined
					}
					onClick={() =>
						handleAddPart({
							partType: manifest.id,
							name:
								findTypeManifest(allManifests, manifest.id, TypeManifestEntity.Part)
									?.buttonLabel ??
								manifest.buttonLabel ??
								manifest.name,
							fromPreset: true
						})
					}
				>
					<span className="preset-button__icon" aria-hidden>
						<PartTypeIcon partType={manifest.id} size={12} />
					</span>
					{manifest.buttonLabel ?? manifest.shortName ?? manifest.name}
				</button>
			))}
		</Stack>
	)
}
