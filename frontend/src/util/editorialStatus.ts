export type EditorialStatus = 'checked' | 'skipped' | 'unchecked'

export function resolveEditorialStatus(options: {
	skip?: boolean
	editorChecked?: boolean
	skipStatusUnlessEditorChecked?: boolean
	requireEditorCheckForAir?: boolean
}): { status: EditorialStatus; tooltip: string } | null {
	const {
		skip,
		editorChecked,
		skipStatusUnlessEditorChecked = true,
		requireEditorCheckForAir = false
	} = options

	if (editorChecked) {
		return { status: 'checked', tooltip: 'Checked by editor' }
	}

	if (skip && skipStatusUnlessEditorChecked) {
		return { status: 'skipped', tooltip: 'Skipped — not counted in timing' }
	}

	if (requireEditorCheckForAir) {
		return {
			status: 'unchecked',
			tooltip: 'Not checked by an editor (required before on-air)'
		}
	}

	return null
}
