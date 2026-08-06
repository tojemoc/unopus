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
	const [generatingId, setGeneratingId] = useState<string | null>(null)
	const onAfterSuccessRef = useRef(onAfterSuccess)
	onAfterSuccessRef.current = onAfterSuccess

	const generate = useCallback(
		async (templateId: string) => {
			setGeneratingId(templateId)
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
				setGeneratingId(null)
			}
		},
		[dispatch, navigate, toasts]
	)

	return {
		generate,
		generatingId,
		isGenerating: (templateId?: string) =>
			templateId ? generatingId === templateId : generatingId !== null
	}
}
