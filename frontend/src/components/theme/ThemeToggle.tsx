import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { BsMoonStars, BsSun } from 'react-icons/bs'
import { useTheme } from '~/theme/ThemeProvider'

export function ThemeToggle() {
	const { theme, toggle } = useTheme()
	const isDark = theme === 'dark'

	return (
		<OverlayTrigger
			placement="bottom"
			overlay={
				<Tooltip id="theme-toggle">
					{isDark ? 'Switch to light theme' : 'Switch to dark theme'}
				</Tooltip>
			}
		>
			<Button
				variant="outline-secondary"
				size="sm"
				className="theme-toggle-btn"
				onClick={toggle}
				aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
				aria-pressed={isDark}
			>
				{isDark ? <BsSun aria-hidden /> : <BsMoonStars aria-hidden />}
			</Button>
		</OverlayTrigger>
	)
}
