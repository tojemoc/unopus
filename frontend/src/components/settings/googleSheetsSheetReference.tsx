import { Table } from 'react-bootstrap'
import {
	PRODUCTION_HOT_SHEET_EXAMPLES,
	VMIX_AUTOMATION_SHEET_COLUMNS,
	VMIX_SHEET_PULL_AUTOMATION,
	VMIX_SHEET_PUSH_AUTOMATION
} from '~backend/background/adapters/sheets/sheetLayout'

export function GoogleSheetsSheetReference() {
	return (
		<div className="mb-4">
			<h4 className="h6">Sheet layout (Companion / vMix)</h4>
			<p className="text-muted small mb-2">
				This is the same grid your team edits in Google Sheets today. Push writes columns C–K;
				mappings below control which fields round-trip on pull.
			</p>
			<Table size="sm" bordered responsive className="small mb-3">
				<thead>
					<tr>
						<th>Col</th>
						<th>Production-hot header</th>
						<th>Role in the show</th>
						<th>Push</th>
						<th>Pull map</th>
					</tr>
				</thead>
				<tbody>
					{VMIX_AUTOMATION_SHEET_COLUMNS.map((col) => (
						<tr key={col.letter}>
							<td>
								<code>{col.letter}</code>
							</td>
							<td>{col.productionHeader ?? col.label}</td>
							<td>{col.role}</td>
							<td>{col.writtenOnPush ? 'Writes' : 'Preserves'}</td>
							<td>{col.mappable ? 'Yes' : '—'}</td>
						</tr>
					))}
				</tbody>
			</Table>

			<h5 className="h6 mt-3">Examples from a Friday production-hot row</h5>
			<Table size="sm" bordered responsive className="small mb-3">
				<thead>
					<tr>
						<th>Blok (C)</th>
						<th>E / F</th>
						<th>Transition (I)</th>
						<th>Playout (J)</th>
					</tr>
				</thead>
				<tbody>
					{PRODUCTION_HOT_SHEET_EXAMPLES.map((ex) => (
						<tr key={ex.note}>
							<td>{ex.block}</td>
							<td>
								{ex.headline1}
								{'headline2' in ex && ex.headline2 ? ` / ${ex.headline2}` : ''}
							</td>
							<td>{ex.transition}</td>
							<td>{ex.playout ?? '—'}</td>
						</tr>
					))}
				</tbody>
			</Table>

			<div className="row g-3">
				<div className="col-md-6">
					<h5 className="h6">On push (automatic)</h5>
					<ul className="small text-muted mb-0 ps-3">
						{VMIX_SHEET_PUSH_AUTOMATION.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</div>
				<div className="col-md-6">
					<h5 className="h6">On pull (your mappings)</h5>
					<ul className="small text-muted mb-0 ps-3">
						{VMIX_SHEET_PULL_AUTOMATION.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	)
}
