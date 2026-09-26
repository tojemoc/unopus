/**
 * Broadcast / newsroom icon set for Unopus.
 * Flat 2D strokes — readable at 14–18px, denser than generic SaaS glyphs.
 */

import type { ReactNode } from 'react'

type IconProps = {
	className?: string
	title?: string
	size?: number
}

function Svg({
	size = 16,
	className,
	title,
	children,
	viewBox = '0 0 16 16'
}: IconProps & { children: ReactNode; viewBox?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox={viewBox}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden={title ? undefined : true}
			role={title ? 'img' : undefined}
		>
			{title ? <title>{title}</title> : null}
			{children}
		</svg>
	)
}

const stroke = {
	stroke: 'currentColor',
	strokeWidth: 1.5,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const
}

/** Unopus brand mark — stacked rundown bars + signal tip. */
export function IconUnopusMark({ size = 18, className, title = 'Unopus' }: IconProps) {
	return (
		<Svg size={size} className={className} title={title} viewBox="0 0 20 20">
			<rect x="3" y="3.5" width="14" height="2.2" rx="0.6" fill="currentColor" opacity="0.95" />
			<rect x="3" y="8" width="10" height="2.2" rx="0.6" fill="currentColor" opacity="0.75" />
			<rect x="3" y="12.5" width="12" height="2.2" rx="0.6" fill="currentColor" opacity="0.55" />
			<circle cx="16.2" cy="9.1" r="1.6" fill="currentColor" />
		</Svg>
	)
}

export function IconRundowns(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 3.5h10v9.5H3z" {...stroke} />
			<path d="M5 6h6M5 8.5h6M5 11h4" {...stroke} />
			<path d="M13 5.5h2.5v8.5H6" {...stroke} />
		</Svg>
	)
}

export function IconScripts(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M4 2.5h6.5L13 5v8.5H4z" {...stroke} />
			<path d="M10.5 2.5V5H13" {...stroke} />
			<path d="M6 7.5h4.5M6 10h4.5M6 12.5h3" {...stroke} />
		</Svg>
	)
}

export function IconSettingsGear(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="8" cy="8" r="2.2" {...stroke} />
			<path
				d="M8 2.2v1.4M8 12.4v1.4M2.2 8h1.4M12.4 8h1.4M3.9 3.9l1 1M11.1 11.1l1 1M12.1 3.9l-1 1M4.9 11.1l-1 1"
				{...stroke}
			/>
		</Svg>
	)
}

export function IconPlusRundown(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 3.5h8v9H3z" {...stroke} />
			<path d="M5 6.5h4M5 9h2.5" {...stroke} />
			<path d="M12.5 9v4.5M10.2 11.2H14.8" {...stroke} />
		</Svg>
	)
}

export function IconPlus(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M8 3.5v9M3.5 8h9" {...stroke} />
		</Svg>
	)
}

export function IconCalendarShow(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 4.5h10v9H3z" {...stroke} />
			<path d="M3 7h10M6 3v2.5M10 3v2.5" {...stroke} />
			<path d="M5.5 9.5h1.2M7.9 9.5h1.2M10.3 9.5h1.2M5.5 11.8h1.2M7.9 11.8h1.2" {...stroke} />
		</Svg>
	)
}

export function IconAllRundowns(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M2.5 4h11M2.5 8h11M2.5 12h8" {...stroke} />
			<path d="M4 2.5v3M4 6.5v3M4 10.5v3" {...stroke} />
		</Svg>
	)
}

export function IconTemplates(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 3h6.5l3.5 3.5V13H3z" {...stroke} />
			<path d="M9.5 3v3.5H13" {...stroke} />
			<path d="M5.5 8.5h5M5.5 10.8h3.5" {...stroke} opacity={0.85} />
		</Svg>
	)
}

export function IconUsers(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="6" cy="5.5" r="2" {...stroke} />
			<path d="M2.5 12.5c.4-2.2 1.8-3.3 3.5-3.3s3.1 1.1 3.5 3.3" {...stroke} />
			<circle cx="11.2" cy="6.2" r="1.6" {...stroke} />
			<path d="M10 12.5c.3-1.4 1.2-2.2 2.4-2.2.5 0 1 .1 1.4.4" {...stroke} />
		</Svg>
	)
}

export function IconIntegrations(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M6.5 3.5v3.2M9.5 9.3v3.2" {...stroke} />
			<path d="M5 5.2h3M8 11h3" {...stroke} />
			<path d="M3.5 8h9" {...stroke} />
			<circle cx="6.5" cy="3.5" r="1.2" {...stroke} />
			<circle cx="9.5" cy="12.5" r="1.2" {...stroke} />
			<path d="M11.5 5.5l1.5 1.5-1.5 1.5M4.5 6.5 3 8l1.5 1.5" {...stroke} />
		</Svg>
	)
}

export function IconCollapseSidebar(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 3h4v10H3z" {...stroke} />
			<path d="M10.5 5.5 8 8l2.5 2.5M12.5 8H8.2" {...stroke} />
		</Svg>
	)
}

export function IconExpandSidebar(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 3h4v10H3z" {...stroke} />
			<path d="M8.5 5.5 11 8l-2.5 2.5M7.5 8H11.8" {...stroke} />
		</Svg>
	)
}

export function IconSearch(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="7" cy="7" r="3.5" {...stroke} />
			<path d="M9.8 9.8 13 13" {...stroke} />
		</Svg>
	)
}

export function IconRefresh(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M13 8a5 5 0 1 1-1.4-3.4" {...stroke} />
			<path d="M13 3.5V7h-3.5" {...stroke} />
		</Svg>
	)
}

export function IconClock(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="8" cy="8" r="5.2" {...stroke} />
			<path d="M8 5.2V8l2 1.4" {...stroke} />
		</Svg>
	)
}

export function IconDiff(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 8h10M8 3v10" {...stroke} />
			<path d="M5.2 5.2 3 8l2.2 2.8M10.8 5.2 13 8l-2.2 2.8" {...stroke} />
		</Svg>
	)
}

export function IconOnAir(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="8" cy="8" r="2.2" fill="currentColor" />
			<path d="M4.2 4.2a5.4 5.4 0 0 1 0 7.6M11.8 4.2a5.4 5.4 0 0 0 0 7.6" {...stroke} />
		</Svg>
	)
}

export function IconSync(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3.5 8a4.5 4.5 0 0 1 7.4-3.4L12.5 3v4h-4" {...stroke} />
			<path d="M12.5 8a4.5 4.5 0 0 1-7.4 3.4L3.5 13V9h4" {...stroke} />
		</Svg>
	)
}

export function IconCore(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M8 2.5 13 5.2v5.6L8 13.5 3 10.8V5.2z" {...stroke} />
			<circle cx="8" cy="8" r="1.8" {...stroke} />
		</Svg>
	)
}

export function IconMediaReady(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 8.2 6.2 11.4 13 4.6" {...stroke} />
		</Svg>
	)
}

export function IconMediaMissing(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M4 4l8 8M12 4 4 12" {...stroke} />
		</Svg>
	)
}

export function IconScriptCue(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3.5 3.5h6.5v9H3.5z" {...stroke} />
			<path d="M5.2 6h3.2M5.2 8.2h3.2M5.2 10.4h2" {...stroke} />
			<path d="M11.5 6.5 13.5 8l-2 1.5" {...stroke} />
		</Svg>
	)
}

export function IconClip(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3.5 4.5h9v7h-9z" {...stroke} />
			<path d="M7 7.2 10 8.5 7 9.8z" fill="currentColor" stroke="none" />
		</Svg>
	)
}

export function IconCamera(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M2.8 5.5h7.2v6H2.8z" {...stroke} />
			<path d="M10 7.2 13.2 5.8v5.4L10 9.8z" {...stroke} />
			<circle cx="6.4" cy="8.5" r="1.4" {...stroke} />
		</Svg>
	)
}

export function IconMic(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M8 2.8a1.8 1.8 0 0 1 1.8 1.8v4a1.8 1.8 0 0 1-3.6 0v-4A1.8 1.8 0 0 1 8 2.8z" {...stroke} />
			<path d="M4.5 8.2a3.5 3.5 0 0 0 7 0M8 11.7V13.5" {...stroke} />
		</Svg>
	)
}

export function IconGfx(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 4h10v8H3z" {...stroke} />
			<path d="M3 10.2 6.2 7.5l2.1 2.1L11.5 6.5 13 7.8" {...stroke} />
			<circle cx="6" cy="6.2" r="0.9" fill="currentColor" />
		</Svg>
	)
}

export function IconHeadline(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3.5 3.5h9" {...stroke} />
			<path d="M3.5 6.5h7" {...stroke} />
			<path d="M3.5 9.5h9" {...stroke} />
			<path d="M3.5 12.5h5" {...stroke} />
		</Svg>
	)
}

export function IconSport(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="8" cy="8" r="5" {...stroke} />
			<path d="M3.5 8h9M8 3.5c1.4 1.6 1.4 7.4 0 9M8 3.5c-1.4 1.6-1.4 7.4 0 9" {...stroke} />
		</Svg>
	)
}

export function IconLink(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M6.2 9.8a2.4 2.4 0 0 1 0-3.4l1.6-1.6a2.4 2.4 0 1 1 3.4 3.4l-.7.7" {...stroke} />
			<path d="M9.8 6.2a2.4 2.4 0 0 1 0 3.4L8.2 11.2a2.4 2.4 0 1 1-3.4-3.4l.7-.7" {...stroke} />
		</Svg>
	)
}

export function IconLogout(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M7 3.5H3.5v9H7" {...stroke} />
			<path d="M7.5 8H13M10.5 5.5 13 8l-2.5 2.5" {...stroke} />
		</Svg>
	)
}

export function IconSegment(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" {...stroke} />
		</Svg>
	)
}

export function IconImport(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M8 2.5v7.5M5.5 7.5 8 10l2.5-2.5" {...stroke} />
			<path d="M3.5 12.5h9" {...stroke} />
		</Svg>
	)
}

export function IconDragHandle(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M5.5 4h1M9.5 4h1M5.5 8h1M9.5 8h1M5.5 12h1M9.5 12h1" {...stroke} />
		</Svg>
	)
}

export function IconLock(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M5 7.2V5.5a3 3 0 0 1 6 0v1.7" {...stroke} />
			<path d="M4 7.2h8v6.3H4z" {...stroke} />
			<path d="M8 9.5v2" {...stroke} />
		</Svg>
	)
}

/** Map part/piece type ids to a small broadcast glyph. */
export function PartTypeIcon({ partType, size = 12, className }: IconProps & { partType: string }) {
	const id = partType.toLowerCase()
	if (id.includes('cam')) return <IconCamera size={size} className={className} />
	if (
		id.includes('syn') ||
		id.includes('siv') ||
		id.includes('sjv') ||
		id === 'vo' ||
		id.startsWith('vo') ||
		id.includes('voice')
	)
		return <IconMic size={size} className={className} />
	if (id.includes('gfx') || id.includes('l3d') || id.includes('double') || id.includes('box'))
		return <IconGfx size={size} className={className} />
	if (id.includes('sport')) return <IconSport size={size} className={className} />
	if (id.includes('ilu') || id.includes('vt') || id.includes('clip') || id.includes('package'))
		return <IconClip size={size} className={className} />
	if (id.includes('intro') || id.includes('headline') || id.includes('zaver') || id.includes('tema'))
		return <IconHeadline size={size} className={className} />
	return <IconScripts size={size} className={className} />
}
