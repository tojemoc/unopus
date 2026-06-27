const LABELS: Record<string, string> = {
	externalId: 'Reference ID',
	float: 'Floated (not in timing)',
	floated: 'Floated',
	partType: 'Story type',
	pieceType: 'Element type',
	sync: 'Sync to Sofie',
	script: 'Script / voiceover',
	duration: 'Duration (seconds)',
	start: 'Start offset (seconds)',
	rank: 'Order',
	segmentType: 'Block type',
	coreUrl: 'Sofie Core address',
	corePort: 'Sofie Core port',
	ingestMediaRoot: 'Ingest media root folder',
	previewBaseUrl: 'GFX preview base URL',
	expectedStartTime: 'Planned start',
	expectedEndTime: 'Planned end',
	isTemplate: 'Save as template'
}

export function friendlyLabel(fieldName: string): string {
	return LABELS[fieldName] ?? fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}
