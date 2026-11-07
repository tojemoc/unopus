import type { RundownStats } from '~backend/background/interfaces'
import { request } from './mediaApi'

export async function fetchRundownStats(): Promise<Record<string, RundownStats>> {
	const data = await request<{ stats: Record<string, RundownStats> }>('/api/rundowns/stats')
	return data.stats
}
