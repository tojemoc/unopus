import { Link, type LinkProps } from '@tanstack/react-router'
import classNames from 'classnames'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { displayTime } from './displayTime'
import { Form, Stack } from 'react-bootstrap'
import { BsCopy } from 'react-icons/bs'
import { HoverIconButton } from '~/components/rundownList/hoverIconButton'

type SidebarItemProps = {
	label: ReactNode
	duration?: number | null
	floated?: boolean
	linkTo?: string
	linkParams?: Record<string, string>
	handleCopy: () => void
	deleteButton: ReactNode
	buttonClassName?: string
	/** When set, the title becomes click-to-edit and commits on blur/Enter. */
	onRename?: (name: string) => void | Promise<void>
	renameValue?: string
} & Partial<LinkProps>

export function SidebarElementHeader({
	label,
	duration,
	floated = false,
	linkTo,
	linkParams,
	handleCopy,
	deleteButton,
	buttonClassName,
	onRename,
	renameValue
}: SidebarItemProps) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(renameValue ?? '')
	const [saving, setSaving] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (!editing) {
			setDraft(renameValue ?? '')
		}
	}, [renameValue, editing])

	useEffect(() => {
		if (editing) {
			inputRef.current?.focus()
			inputRef.current?.select()
		}
	}, [editing])

	const commitRename = async () => {
		if (!onRename) {
			setEditing(false)
			return
		}
		const next = draft.trim()
		const previous = (renameValue ?? '').trim()
		if (!next || next === previous) {
			setDraft(renameValue ?? '')
			setEditing(false)
			return
		}
		setSaving(true)
		try {
			await onRename(next)
			setEditing(false)
		} catch {
			setDraft(renameValue ?? '')
			setEditing(false)
		} finally {
			setSaving(false)
		}
	}

	const title = onRename ? (
		editing ? (
			<Form.Control
				ref={inputRef}
				size="sm"
				className="sidebar-item-header__rename"
				value={draft}
				disabled={saving}
				aria-label="Segment name"
				onClick={(e) => e.stopPropagation()}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={() => {
					void commitRename()
				}}
				onKeyDown={(e) => {
					e.stopPropagation()
					if (e.key === 'Enter') {
						e.preventDefault()
						void commitRename()
					} else if (e.key === 'Escape') {
						e.preventDefault()
						setDraft(renameValue ?? '')
						setEditing(false)
					}
				}}
			/>
		) : (
			<button
				type="button"
				className="sidebar-item-header__rename-trigger item-title"
				title="Click to rename"
				onClick={(e) => {
					e.preventDefault()
					e.stopPropagation()
					setEditing(true)
				}}
			>
				{label}
			</button>
		)
	) : (
		<span className="item-title">{label}</span>
	)

	const body = (
		<Stack
			direction="horizontal"
			className={classNames(buttonClassName, 'sidebar-item-header', {
				floated
			})}
			gap={2}
		>
			{title}
			<span className="item-duration">{duration ? displayTime(duration) : '--:--'}</span>
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
	)

	if (linkTo && linkParams && !onRename) {
		return (
			<Link to={linkTo} params={linkParams}>
				{body}
			</Link>
		)
	}

	return body
}
