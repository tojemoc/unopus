import { db } from './db'

export interface MediaClipSummary {
	id: string
	name: string
	path?: string
}

/** Distinct video piece file names previously saved in the local database. */
export function getVideoFileNameHistory(): MediaClipSummary[] {
	const rows = db
		.prepare(
			`
			SELECT DISTINCT json_extract(document, '$.payload.fileName') AS fileName
			FROM pieces
			WHERE json_extract(document, '$.pieceType') = 'video'
				AND json_extract(document, '$.payload.fileName') IS NOT NULL
				AND trim(json_extract(document, '$.payload.fileName')) != ''
			ORDER BY fileName COLLATE NOCASE
		`
		)
		.all() as Array<{ fileName: string }>

	return rows.map((row) => ({
		id: row.fileName,
		name: row.fileName
	}))
}
