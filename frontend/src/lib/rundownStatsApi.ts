import type { RundownStats } from '~backend/background/interfaces'
import { request } from './mediaApi'

/** Fetches per-rundown segment/part/piece counts from the stats endpoint. */
export async function fetchRundownStats(): Promise<Record<string, RundownStats>> {
	const data = await request<{ stats: Record<string, RundownStats> }>('/api/rundowns/stats')
	return data.stats
}
