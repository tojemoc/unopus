import type { UseNavigateResult } from '@tanstack/react-router'
import { Card, Stack, ListGroup, Button, Badge, Modal } from 'react-bootstrap'
import { BsBoxArrowInUp, BsChevronDown, BsChevronRight } from 'react-icons/bs'
import type { Segment, Rundown } from '~backend/background/interfaces'
import SegmentItem from './segmentItem'
import { useState } from 'react'

interface Props {
	rundown: Rundown
	segments: Segment[]
	isExpanded: boolean
	toggle: () => void
	onClone: () => void
	targetRundownId: string
	onClose: () => void
	navigate: UseNavigateResult<string>
	rank: number
}

export default function TemplateRundownCard({
	rundown,
	segments,
	isExpanded,
	toggle,
	onClone,
	targetRundownId,
	onClose,
	navigate,
	rank
}: Props) {
	const [showConfirm, setShowConfirm] = useState(false)

	const handleConfirm = () => {
		setShowConfirm(false)
		onClone()
	}

	const hasSegments = segments.length > 0

	return (
		<Card className="mb-2 shadow-sm border-0 template-rundown-card">
			<Card.Header className="py-2 rounded template-rundown-card__header rundown-header">
				<Stack direction="horizontal" gap={2} style={{ alignItems: 'center' }}>
					{
						<Button
							variant="link"
							className="p-0 text-decoration-none"
							onClick={toggle}
							aria-expanded={isExpanded}
							style={{ ...(!hasSegments ? { opacity: 0, pointerEvents: 'none' } : {}) }}
						>
							{isExpanded ? (
								<BsChevronDown />
							) : (
								<BsChevronRight />
							)}
						</Button>
					}

					<Card.Title className="mb-0 fw-semibold text-truncate">{rundown.name}</Card.Title>

					{hasSegments && (
						<Badge className="ms-1 template-rundown-card__badge">{segments.length}</Badge>
					)}

					<div className="ms-auto rundown-import-action">
						<Button size="sm" variant="outline-light" onClick={() => setShowConfirm(true)}>
							<BsBoxArrowInUp aria-hidden className="icon-md" /> Import rundown
						</Button>
					</div>
				</Stack>
			</Card.Header>

			{isExpanded && hasSegments && (
				<Card.Body className="p-0">
					<ListGroup variant="flush  rounded-bottom">
						{segments
							.sort((a, b) => a.rank - b.rank)
							.map((segment) => (
								<SegmentItem
									key={segment.id}
									segment={segment}
									targetRundownId={targetRundownId}
									onClose={onClose}
									navigate={navigate}
									rank={rank}
								/>
							))}
					</ListGroup>
				</Card.Body>
			)}
			<Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
				<Modal.Header closeButton>
					<Modal.Title>Import rundown</Modal.Title>
				</Modal.Header>

				<Modal.Body>
					<p className="mb-2">
						This action will import <strong>all segments</strong> from{' '}
						<strong>{rundown.name}</strong>. This includes all regular segments too, not just
						template segments.
					</p>
				</Modal.Body>

				<Modal.Footer>
					<Button variant="secondary" onClick={() => setShowConfirm(false)}>
						Cancel
					</Button>
					<Button variant="primary" onClick={handleConfirm}>
						Import all segments
					</Button>
				</Modal.Footer>
			</Modal>
		</Card>
	)
}
