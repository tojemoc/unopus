import { createContext, useContext, type ReactNode } from 'react'

const StoryFilterContext = createContext('')

export function StoryFilterProvider({
	filter,
	children
}: {
	filter: string
	children: ReactNode
}) {
	return <StoryFilterContext.Provider value={filter}>{children}</StoryFilterContext.Provider>
}

export function useStoryFilter(): string {
	return useContext(StoryFilterContext)
}

export function matchesStoryFilter(
	filter: string,
	name: string,
	script?: string | null
): boolean {
	const normalized = filter.trim().toLowerCase()
	if (!normalized) return true
	return `${name}\n${script ?? ''}`.toLowerCase().includes(normalized)
}
