import { useNavigate } from '@tanstack/react-router'
import { type Dispatch, type SetStateAction } from 'react'
import { Stack } from 'react-bootstrap'
import { IconImport, IconPlus, IconSegment } from '~/components/icons/broadcastIcons'
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
	showImport = true,
	variant = 'default'
}: {
	rundownId: string
	playlistId: string | null
	rank: number
	setShowImportModal: Dispatch<SetStateAction<number | undefined>>
	showImport?: boolean
	/** `hero` = large centered CTAs for an empty rundown */
	variant?: 'default' | 'hero'
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()

	const segmentTypeManifests = useAppSelector((state) =>
		toolbarManifests(state.typeManifests.manifests, TypeManifestEntity.Segment)
	)

	const handleAddSegment = (opts: {
		segmentType: string
		name: string
		materializePreset: boolean
	}) => {
		dispatch(
			addNewSegment({
				rundownId,
				playlistId,
				rank,
				segmentType: opts.segmentType,
				name: opts.name,
				materializePreset: opts.materializePreset,
				payload: opts.segmentType
					? { type: opts.segmentType, name: opts.name }
					: { name: opts.name }
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

	const hero = variant === 'hero'

	return (
		<div className={`segment-create${hero ? ' segment-create--hero' : ''}`}>
			{hero ? (
				<div className="segment-create__intro">
					<h2 className="segment-create__title">Start this rundown</h2>
					<p className="segment-create__subtitle">
						Add a segment type, or create a blank segment and fill it in.
					</p>
				</div>
			) : null}
			<Stack
				className={`segment-buttons preset-buttons${hero ? ' segment-buttons--hero' : ''}`}
				direction="horizontal"
				gap={hero ? 2 : 1}
			>
				<button
					className="segment-button add-button empty-segment-button"
					type="button"
					title="Create an empty segment with no preset parts"
					onClick={() =>
						handleAddSegment({
							segmentType: '',
							name: `Segment ${rank + 1}`,
							materializePreset: false
						})
					}
				>
					<span className="preset-button__icon" aria-hidden>
						<IconPlus size={hero ? 16 : 13} />
					</span>
					Empty segment
				</button>
				{segmentTypeManifests.map((manifest) => (
					<button
						key={manifest.id}
						className="segment-button preset-button"
						type="button"
						style={
							hero
								? {
										borderColor: manifest.colour,
										backgroundColor: manifest.colour,
										color: 'var(--re-text-on-chip)'
									}
								: { borderColor: manifest.colour }
						}
						onClick={() =>
							handleAddSegment({
								segmentType: manifest.id,
								name: manifest.buttonLabel ?? manifest.name,
								materializePreset: true
							})
						}
					>
						<span className="preset-button__icon" aria-hidden>
							<IconSegment size={hero ? 15 : 12} />
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
							<IconImport size={hero ? 15 : 13} />
						</span>
						Import
					</button>
				)}
			</Stack>
		</div>
	)
}
