import { createFileRoute } from '@tanstack/react-router'
import { Stack } from 'react-bootstrap'
import { RundownBreadcrumbs } from '~/components/rundown/breadcrumbs'
import { PiecePropertiesForm } from '~/components/rundown/piecePropertiesForm'
import { PiecesList } from '~/components/rundown/piecesList'
import { useAppSelector } from '~/store/app'

export const Route = createFileRoute(
	'/rundown/$rundownId/segment/$segmentId/part/$partId/piece/$pieceId'
)({
	component: RouteComponent
})

function RouteComponent() {
	const { rundownId, segmentId, partId, pieceId } = Route.useParams()
	const navigate = Route.useNavigate()

	const part = useAppSelector((state) =>
		state.parts.parts.find(
			(s) => s.rundownId === rundownId && s.segmentId === segmentId && s.id === partId
		)
	)

	const piece = useAppSelector((state) =>
		state.pieces.pieces.find(
			(s) =>
				s.rundownId === rundownId &&
				s.segmentId === segmentId &&
				s.partId === partId &&
				s.id === pieceId
		)
	)
	if (!piece || !part) {
		navigate({
			to: `/rundown/${rundownId}/segment/${segmentId}/${partId}`
		})
		return null
	}

	return (
		<Stack className="rundown-main-content rundown-main-content-fill">
			<RundownBreadcrumbs rundownId={rundownId} />
			<div className="rundown-main-content-properties rundown-main-content-properties-split">
				<Stack direction="horizontal" key={`form_${partId}`} className="align-items-stretch">
					<div className="p-4 rundown-split-pane re-surface-panel">
						<PiecesList key={`piecesList_${partId}`} part={part} />
					</div>
					<div className="p-4 rundown-split-pane rundown-piece-properties-panel re-surface-form">
						<PiecePropertiesForm key={`piecesProperties_${piece.id}`} piece={piece} />
					</div>
				</Stack>
			</div>
		</Stack>
	)
}
