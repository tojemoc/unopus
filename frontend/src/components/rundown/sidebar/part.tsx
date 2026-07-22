import { useNavigate } from '@tanstack/react-router'
import { useAppDispatch, useAppSelector } from '~/store/app'
import { copyPart } from '~/store/parts'
import type { Part, Segment } from '~backend/background/interfaces'
import { SidebarElementHeader } from './sidebarElementHeader'
import { useToasts } from '~/components/toasts/useToasts'
import { BsFillTrashFill, BsTrash } from 'react-icons/bs'
import { PartTypeButtons } from './partTypeButtons'
import { DeletePartButton } from '../deletePartButton'
import type { ButtonProps } from 'react-bootstrap'
import { HoverIconButton } from '~/components/rundownList/hoverIconButton'
import { findTypeManifest } from '~/util/typeManifest'
import { TypeManifestEntity } from '~backend/background/interfaces'

export function SidebarPart({
	part,
	segment,
	insertRank,
	lastEdit
}: {
	part: Part
	segment: Segment
	insertRank: number
	lastEdit?: { displayName: string; editedAt: number }
}) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()
	const partTypeManifest = useAppSelector((state) =>
		findTypeManifest(state.typeManifests.manifests, part.partType, TypeManifestEntity.Part)
	)

	const handleCopyPart = () =>
		dispatch(copyPart({ id: part.id, rundownId: part.rundownId }))
			.unwrap()
			.then((newPart) =>
				navigate({
					to: `/rundown/${newPart.rundownId}/segment/${newPart.segmentId}/part/${newPart.id}`
				})
			)
			.catch(() =>
				toasts.show({
					headerContent: 'Adding piece',
					bodyContent: 'Encountered an unexpected error'
				})
			)

	return (
		<div className="sidebar-part-wrapper">
			<div
				className="sidebar-part copy-item bg-dark"
				style={{
					borderLeft: `4px solid ${partTypeManifest?.colour ?? '#666'}`
				}}
			>
				<SidebarElementHeader
					label={
						<>
							{part.name}
							{lastEdit && (
								<span className="part-edit-hint text-muted ms-2">
									· {lastEdit.displayName}
								</span>
							)}
						</>
					}
					duration={part.duration}
					linkTo={'/rundown/$rundownId/segment/$segmentId/part/$partId'}
					linkParams={{
						rundownId: segment.rundownId,
						segmentId: segment.id,
						partId: part.id
					}}
					handleCopy={handleCopyPart}
					deleteButton={
						<DeletePartButton
							rundownId={part.rundownId}
							segmentId={part.segmentId}
							partId={part.id}
							partName={part.name}
							disabled={false}
							style={{ zIndex: 4 }}
							renderButton={({ onClick, disabled }: ButtonProps) => (
								<HoverIconButton
									onClick={onClick}
									disabled={disabled}
									className="sync-plus-wrapper ms-auto"
									defaultIcon={<BsTrash className="icon-md" color="var(--bs-danger)" />}
									hoverIcon={<BsFillTrashFill className="icon-md" color="var(--bs-danger)" />}
								/>
							)}
						/>
					}
				/>
			</div>
			<div className="part-button add-button-container">
				<PartTypeButtons segment={segment} rank={insertRank} />
			</div>
		</div>
	)
}
