import { useCallback, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { DailyGenerationResult } from '~backend/background/interfaces'
import { useAppDispatch } from '~/store/app'
import { pushRundown } from '~/store/rundowns'
import { generateDailyRundownNow } from '~/lib/dailyGenerationApi'
import { useToasts } from '~/components/toasts/useToasts'

export function useGenerateDailyRundown(
	onAfterSuccess?: (result: DailyGenerationResult) => void | Promise<void>
) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const toasts = useToasts()
	const [pendingByTemplate, setPendingByTemplate] = useState<Record<string, number>>({})
	const onAfterSuccessRef = useRef(onAfterSuccess)
	onAfterSuccessRef.current = onAfterSuccess

	const beginPending = useCallback((templateId: string) => {
		setPendingByTemplate((prev) => ({
			...prev,
			[templateId]: (prev[templateId] ?? 0) + 1
		}))
	}, [])

	const endPending = useCallback((templateId: string) => {
		setPendingByTemplate((prev) => {
			const next = { ...prev }
			const count = (next[templateId] ?? 0) - 1
			if (count <= 0) {
				delete next[templateId]
			} else {
				next[templateId] = count
			}
			return next
		})
	}, [])

	const generate = useCallback(
		async (templateId: string) => {
			beginPending(templateId)
			try {
				const result = await generateDailyRundownNow(templateId)
				if (result.rundown) {
					dispatch(pushRundown(result.rundown))
				}
				await onAfterSuccessRef.current?.(result)

				if (result.status === 'in_progress') {
					toasts.show({
						headerContent: 'Generate now',
						bodyContent:
							'Another generation attempt is still in progress — try again shortly'
					})
					return result
				}

				toasts.show({
					headerContent: result.created
						? "Generated today's rundown"
						: 'Already generated',
					bodyContent: result.rundown?.name ?? result.rundownId ?? ''
				})
				if (result.created && result.rundownId) {
					await navigate({ to: `/rundown/${result.rundownId}` })
				}
				return result
			} catch (error) {
				console.error(error)
				toasts.show({
					headerContent: 'Generate now',
					bodyContent: error instanceof Error ? error.message : 'Unexpected error'
				})
				return null
			} finally {
				endPending(templateId)
			}
		},
		[beginPending, dispatch, endPending, navigate, toasts]
	)

	return {
		generate,
		isGenerating: (templateId?: string) =>
			templateId
				? (pendingByTemplate[templateId] ?? 0) > 0
				: Object.keys(pendingByTemplate).length > 0
	}
}
