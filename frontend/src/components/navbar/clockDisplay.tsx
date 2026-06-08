import { useEffect, useState } from 'react'
import { useAppSelector } from '~/store/app'
import { formatClockTime } from '~/util/timezone'

export function ClockDisplay() {
	const settings = useAppSelector((s) => s.settings.settings)
	const timeZone = settings?.timezone ?? 'Europe/Bratislava'
	const [now, setNow] = useState(Date.now())

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [])

	return (
		<span className="navbar-clock text-muted small" title={timeZone}>
			{formatClockTime(timeZone, now)}
		</span>
	)
}
