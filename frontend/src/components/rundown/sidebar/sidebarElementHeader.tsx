import { Link, type LinkProps } from '@tanstack/react-router'
import classNames from 'classnames'
import type { ReactNode } from 'react'
import { displayTime } from './displayTime'
import { Stack } from 'react-bootstrap'
import { BsCopy } from 'react-icons/bs'
import { HoverIconButton } from '~/components/rundownList/hoverIconButton'

type SidebarItemProps = {
	label: ReactNode
	duration?: number
	floated?: boolean
	linkTo: string
	linkParams: Record<string, string>
	handleCopy: () => void
	deleteButton: ReactNode
	buttonClassName?: string
} & LinkProps

export function SidebarElementHeader({
	label,
	duration,
	floated = false,
	linkTo,
	linkParams,
	handleCopy,
	deleteButton,
	buttonClassName
}: SidebarItemProps) {
	return (
		<Link to={linkTo} params={linkParams}>
			<Stack
				className={classNames(buttonClassName, 'sidebar-item-header', {
					floated
				})}
				gap={1}
			>
				<div className="segment-header-content">
					<span className="item-title">{label}</span>
				</div>
				<Stack direction="horizontal" className="sidebar-item-header-meta align-items-center">
					<span className="item-duration">
						{duration ? displayTime(duration) : '--:--'}
					</span>
					<Stack className="ms-auto" direction="horizontal" gap={1}>
						{deleteButton}

						<HoverIconButton
							className="sync-plus-wrapper"
							defaultIcon={
								<BsCopy
									className="icon-md text-primary"
									style={{ fontSize: '1em', opacity: '75%' }}
								/>
							}
							hoverIcon={<BsCopy className="icon-md text-primary" style={{ fontSize: '1em' }} />}
							onClick={(e) => {
								e.preventDefault()
								e.stopPropagation()
								handleCopy()
							}}
						/>
					</Stack>
				</Stack>
			</Stack>
		</Link>
	)
}
