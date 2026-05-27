export const defaultNrcsRundown = {
	presenterName: 'News Presenter',
	headlines: [
		{
			title: 'Head 1',
			subtitle: 'Top story',
			summary: 'Top headline summary.'
		},
		{
			title: 'Head 2',
			subtitle: 'Second story',
			summary: 'Second headline summary.'
		},
		{
			title: 'Head 3',
			subtitle: 'Third story',
			summary: 'Third headline summary.'
		}
	],
	main_topics: [
		{
			slug: 'TOPIC_1',
			title: 'Topic 1',
			body: 'Topic 1 opening narration.',
			quotes: [
				{
					speaker: 'Guest',
					role: 'Analyst',
					text: 'Quote for topic 1.'
				}
			]
		}
	],
	one_sentence: [
		{
			title: 'One sentence',
			text: 'One sentence update.'
		}
	],
	sports: [
		{
			title: 'Sports',
			text: 'Sports update.'
		}
	],
	weather: {
		text: 'Weather forecast.'
	},
	recommendation: {
		text: 'Closing recommendation.'
	}
} as const

export const defaultNrcsRundownText = JSON.stringify(defaultNrcsRundown, null, 2)
