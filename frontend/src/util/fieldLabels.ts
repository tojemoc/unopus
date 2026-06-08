const LABELS: Record<string, string> = {
	externalId: 'Reference ID',
	float: 'Floated (not in timing)',
	floated: 'Floated',
	partType: 'Story type',
	pieceType: 'Element type',
	sync: 'Sync to Sofie',
	syncGeneratedRundowns: 'Sync rundowns created from this template',
	script: 'Script / voiceover',
	duration: 'Duration (seconds)',
	start: 'Start offset (seconds)',
	rank: 'Order',
	segmentType: 'Block type',
	coreUrl: 'Sofie Core address',
	corePort: 'Sofie Core port',
	expectedStartTime: 'Planned start',
	expectedEndTime: 'Planned end',
	isTemplate: 'Save as template'
}

export function friendlyLabel(fieldName: string): string {
	return LABELS[fieldName] ?? fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}
