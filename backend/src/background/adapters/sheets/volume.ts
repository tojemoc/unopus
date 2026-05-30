/** Column K (hlasitost) from playout cue (column J). */
export function computeVolume(playout: string): number | '' {
	const p = playout.trim().toUpperCase()
	if (p === 'INTRO' || p === 'Intro') return 0
	if (p.startsWith('HEADLINE')) return 40
	if (p.startsWith('ILU RUCH')) return 85
	if (p.startsWith('ILU')) return 50
	if (p.startsWith('SYN')) return 100
	return ''
}
