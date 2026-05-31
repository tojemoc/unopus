import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import type {
	ApplicationSettings,
	GoogleSheetsColumnKey,
	GoogleSheetsFieldMapping,
	GoogleSheetsPieceTypeMapping
} from '~backend/background/interfaces'
import { GOOGLE_SHEETS_COLUMN_OPTIONS, GOOGLE_SHEETS_RECOMMENDED_MAPPINGS } from '~backend/background/interfaces'
import {
	fetchGoogleSheetsStatus,
	testGoogleSheetsConnection,
	type GoogleSheetsStatus
} from '~/lib/googleSheetsApi'
import { useAppDispatch } from '~/store/app'
import { updateSettings } from '~/store/settings'
import { useToasts } from '../toasts/useToasts'
import { GoogleSheetsSheetReference } from './googleSheetsSheetReference'

type FieldMappingRow = GoogleSheetsFieldMapping & { _key: string }
type PieceMappingRow = Omit<GoogleSheetsPieceTypeMapping, 'fields'> & {
	_key: string
	fields: FieldMappingRow[]
}

function newFieldKey(): string {
	return `field-${crypto.randomUUID()}`
}

function newMappingKey(): string {
	return `mapping-${crypto.randomUUID()}`
}

function toFieldRows(fields: GoogleSheetsFieldMapping[]): FieldMappingRow[] {
	return fields.map((f) => ({ ...f, _key: newFieldKey() }))
}

function toPieceMappingRows(mappings: GoogleSheetsPieceTypeMapping[]): PieceMappingRow[] {
	return mappings.map((m) => ({
		...m,
		_key: newMappingKey(),
		fields: toFieldRows(m.fields)
	}))
}

function stripFieldRow(field: FieldMappingRow): GoogleSheetsFieldMapping {
	const { _key: _unused, ...rest } = field
	void _unused
	return rest
}

function stripPieceRow(mapping: PieceMappingRow): GoogleSheetsPieceTypeMapping {
	const { _key: _unused, fields, ...rest } = mapping
	void _unused
	return {
		...rest,
		fields: fields.map(stripFieldRow)
	}
}

function initialMappings(settings: ApplicationSettings): PieceMappingRow[] {
	const saved = settings.googleSheetsPieceMappings
	if (saved && saved.length > 0) return toPieceMappingRows(saved)
	return toPieceMappingRows(GOOGLE_SHEETS_RECOMMENDED_MAPPINGS)
}

export function GoogleSheetsSettingsForm({ settings }: { settings: ApplicationSettings }) {
	const dispatch = useAppDispatch()
	const toasts = useToasts()
	const [status, setStatus] = useState<GoogleSheetsStatus | null>(null)
	const [loadingStatus, setLoadingStatus] = useState(true)
	const [testing, setTesting] = useState(false)
	const [testMessage, setTestMessage] = useState<string | null>(null)
	const [testVariant, setTestVariant] = useState<'success' | 'danger'>('success')
	const [saving, setSaving] = useState(false)

	const [spreadsheetId, setSpreadsheetId] = useState(
		settings.googleSheetsSpreadsheetId ?? ''
	)
	const [sheetName, setSheetName] = useState(settings.googleSheetsSheetName ?? 'Sheet1')
	const [dataStartRow, setDataStartRow] = useState(String(settings.googleSheetsDataStartRow ?? 2))
	const [credentialsEnvVar, setCredentialsEnvVar] = useState(
		settings.googleSheetsCredentialsEnvVar ?? ''
	)
	const [credentialsPath, setCredentialsPath] = useState(
		settings.googleSheetsCredentialsPath ?? ''
	)
	const [pieceMappings, setPieceMappings] = useState<PieceMappingRow[]>(() =>
		initialMappings(settings)
	)
	const refreshStatus = useCallback(async () => {
		setLoadingStatus(true)
		try {
			setStatus(await fetchGoogleSheetsStatus())
		} catch {
			setStatus(null)
		} finally {
			setLoadingStatus(false)
		}
	}, [])

	useEffect(() => {
		void refreshStatus()
	}, [refreshStatus])

	const updateMapping = (index: number, patch: Partial<PieceMappingRow>) => {
		setPieceMappings((prev) =>
			prev.map((m, i) => (i === index ? { ...m, ...patch } : m))
		)
	}

	const updateFieldMapping = (
		mappingIndex: number,
		fieldIndex: number,
		patch: Partial<GoogleSheetsFieldMapping>
	) => {
		setPieceMappings((prev) =>
			prev.map((m, i) => {
				if (i !== mappingIndex) return m
				const fields = m.fields.map((f, fi) =>
					fi === fieldIndex ? { ...f, ...patch, _key: f._key } : f
				)
				return { ...m, fields }
			})
		)
	}

	const addFieldMapping = (mappingIndex: number) => {
		setPieceMappings((prev) =>
			prev.map((m, i) =>
				i === mappingIndex
					? {
							...m,
							fields: [
								...m.fields,
								{ sourceField: '', sheetColumn: 'headline1', _key: newFieldKey() }
							]
						}
					: m
			)
		)
	}

	const removeFieldMapping = (mappingIndex: number, fieldIndex: number) => {
		setPieceMappings((prev) =>
			prev.map((m, i) =>
				i === mappingIndex
					? { ...m, fields: m.fields.filter((_, fi) => fi !== fieldIndex) }
					: m
			)
		)
	}

	const addPieceMapping = () => {
		setPieceMappings((prev) => [
			...prev,
			{
				_key: newMappingKey(),
				pieceTypeId: '',
				maxRows: undefined,
				transitionContains: '',
				fields: [{ sourceField: '', sheetColumn: 'headline1', _key: newFieldKey() }]
			}
		])
	}

	const saveSheetsSettings = async (): Promise<boolean> => {
		setSaving(true)
		try {
			const row = Math.max(Number(dataStartRow) || 2, 1)
			const cleanedMappings: GoogleSheetsPieceTypeMapping[] = pieceMappings
				.map(stripPieceRow)
				.map((m) => ({
					...m,
					pieceTypeId: m.pieceTypeId.trim(),
					label: m.label?.trim() || undefined,
					description: m.description?.trim() || undefined,
					transitionContains: m.transitionContains?.trim() || undefined,
					maxRows: m.maxRows && m.maxRows > 0 ? m.maxRows : undefined,
					fields: m.fields.filter((f) => f.sourceField.trim())
				}))
				.filter((m) => m.pieceTypeId && m.fields.length > 0)

			await dispatch(
				updateSettings({
					settings: {
						...settings,
						googleSheetsSpreadsheetId: spreadsheetId.trim() || undefined,
						googleSheetsSheetName: sheetName.trim() || undefined,
						googleSheetsDataStartRow: row,
						googleSheetsCredentialsEnvVar: credentialsEnvVar.trim() || undefined,
						googleSheetsCredentialsPath: credentialsPath.trim() || undefined,
						googleSheetsPieceMappings:
							cleanedMappings.length > 0 ? cleanedMappings : undefined
					}
				})
			).unwrap()
			await refreshStatus()
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: 'Settings saved'
			})
			return true
		} catch (e) {
			console.error(e)
			toasts.show({
				headerContent: 'Google Sheets',
				bodyContent: 'Could not save settings'
			})
			return false
		} finally {
			setSaving(false)
		}
	}

	const runTest = async () => {
		setTesting(true)
		setTestMessage(null)
		const saved = await saveSheetsSettings()
		if (!saved) {
			setTesting(false)
			return
		}
		try {
			const result = await testGoogleSheetsConnection()
			if (result.ok) {
				setTestVariant('success')
				setTestMessage(
					`Connected to “${result.title ?? 'spreadsheet'}”` +
						(result.sheetTitle ? ` (sheet: ${result.sheetTitle})` : '') +
						' — read and write verified'
				)
			} else {
				setTestVariant('danger')
				setTestMessage(result.error ?? 'Connection test failed')
			}
			await refreshStatus()
		} catch (e) {
			setTestVariant('danger')
			setTestMessage(e instanceof Error ? e.message : 'Connection test failed')
		} finally {
			setTesting(false)
		}
	}

	const configured = status?.configured ?? false

	const restoreRecommendedMappings = () => {
		setPieceMappings(toPieceMappingRows(GOOGLE_SHEETS_RECOMMENDED_MAPPINGS))
	}

	return (
		<section className="mt-4 pt-3 border-top border-secondary">
			<h3 className="h5">Google Sheets bridge (vMix + Companion)</h3>
			<Alert variant="info" className="py-2 small">
				<strong>Interim workflow.</strong> This keeps your existing automation spreadsheet in sync
				with Rundown Editor until you run fully on Sofie Core. When that migration is done, you can
				stop using Sheets here and rely on Sofie sync only — these settings will no longer be needed.
			</Alert>
			<p className="text-muted small">
				Edit stories in Rundown Editor (parts, pieces, scripts), then <strong>push</strong> to the
				sheet for tonight’s show. Optionally <strong>pull</strong> headline (and other mapped) fields
				back from the sheet when someone still edits cells C–F in Google Sheets.
			</p>

			{loadingStatus ? (
				<Spinner animation="border" size="sm" className="mb-2" />
			) : (
				<Alert variant={configured ? 'success' : 'warning'} className="py-2 small">
					{configured
						? 'Configured — spreadsheet and credentials are available.'
						: 'Not fully configured — set spreadsheet ID and credentials via env or path below.'}
					{status && !configured && status.hasCredentials && !status.spreadsheetId && (
						<span> Credentials are set; spreadsheet ID is missing.</span>
					)}
				</Alert>
			)}

			<Form.Group className="mb-2">
				<Form.Label>Spreadsheet ID</Form.Label>
				<Form.Control
					value={spreadsheetId}
					onChange={(e) => setSpreadsheetId(e.target.value)}
					placeholder="From the Google Sheets URL"
				/>
			</Form.Group>
			<Form.Group className="mb-2">
				<Form.Label>Sheet name</Form.Label>
				<Form.Control value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
			</Form.Group>
			<Form.Group className="mb-2">
				<Form.Label>Data start row</Form.Label>
				<Form.Control
					type="number"
					min={1}
					value={dataStartRow}
					onChange={(e) => setDataStartRow(e.target.value)}
				/>
			</Form.Group>
			<Form.Group className="mb-2">
				<Form.Label>Credentials env var</Form.Label>
				<Form.Control
					value={credentialsEnvVar}
					onChange={(e) => setCredentialsEnvVar(e.target.value)}
					placeholder="GOOGLE_SHEETS_CREDENTIALS_JSON"
				/>
				<Form.Text className="text-muted">
					Name of an environment variable containing the service-account JSON. Defaults to{' '}
					<code>GOOGLE_SHEETS_CREDENTIALS_JSON</code> when empty.
				</Form.Text>
			</Form.Group>
			<Form.Group className="mb-3">
				<Form.Label>Credentials file path (server)</Form.Label>
				<Form.Control
					value={credentialsPath}
					onChange={(e) => setCredentialsPath(e.target.value)}
					placeholder="/path/to/service-account.json"
				/>
				<Form.Text className="text-muted">
					Optional path on the backend host. <code>GOOGLE_SHEETS_CREDENTIALS_PATH</code> env is
					used when this is empty.
				</Form.Text>
			</Form.Group>

			<GoogleSheetsSheetReference />

			<h4 className="h6 mt-2">Piece type → column mappings</h4>
			<p className="text-muted small">
				Each row links a <strong>piece type ID</strong> from Type Manifests to spreadsheet columns.
				Use <code>part.script</code> for the part’s VO script (column D). Set a transition filter so
				pull only touches the rows you mean (e.g. <code>Headline</code> for the three headline lines).
			</p>

			<div className="d-flex flex-wrap gap-2 mb-3">
				<Button variant="outline-secondary" size="sm" onClick={restoreRecommendedMappings}>
					Restore recommended mappings
				</Button>
			</div>

			{pieceMappings.map((mapping, mappingIndex) => (
				<div key={mapping._key} className="border border-secondary rounded p-3 mb-3">
					<div className="row g-2 mb-2">
						<div className="col-md-3">
							<Form.Label className="small mb-0">Display name</Form.Label>
							<Form.Control
								size="sm"
								value={mapping.label ?? ''}
								onChange={(e) => updateMapping(mappingIndex, { label: e.target.value })}
								placeholder="Headline"
							/>
						</div>
						<div className="col-md-3">
							<Form.Label className="small mb-0">Piece type ID</Form.Label>
							<Form.Control
								size="sm"
								value={mapping.pieceTypeId}
								onChange={(e) => updateMapping(mappingIndex, { pieceTypeId: e.target.value })}
								placeholder="head"
							/>
						</div>
						<div className="col-md-3">
							<Form.Label className="small mb-0">Max rows (push/pull)</Form.Label>
							<Form.Control
								size="sm"
								type="number"
								min={1}
								value={mapping.maxRows ?? ''}
								onChange={(e) =>
									updateMapping(mappingIndex, {
										maxRows: e.target.value ? Number(e.target.value) : undefined
									})
								}
								placeholder="e.g. 3"
							/>
						</div>
						<div className="col-md-3">
							<Form.Label className="small mb-0">Pull: transition contains</Form.Label>
							<Form.Control
								size="sm"
								value={mapping.transitionContains ?? ''}
								onChange={(e) =>
									updateMapping(mappingIndex, { transitionContains: e.target.value })
								}
								placeholder="Headline"
							/>
						</div>
					</div>
					<Form.Group className="mb-2">
						<Form.Label className="small mb-0">What this mapping does</Form.Label>
						<Form.Control
							size="sm"
							as="textarea"
							rows={2}
							value={mapping.description ?? ''}
							onChange={(e) => updateMapping(mappingIndex, { description: e.target.value })}
							placeholder="Explain for your team when to use this mapping."
						/>
					</Form.Group>
					<Table size="sm" className="mb-2">
						<thead>
							<tr>
								<th>Source field</th>
								<th>Sheet column</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{mapping.fields.map((field, fieldIndex) => (
								<tr key={field._key}>
									<td>
										<Form.Control
											size="sm"
											value={field.sourceField}
											onChange={(e) =>
												updateFieldMapping(mappingIndex, fieldIndex, {
													sourceField: e.target.value
												})
											}
											placeholder="title"
										/>
									</td>
									<td>
										<Form.Select
											size="sm"
											value={field.sheetColumn}
											onChange={(e) =>
												updateFieldMapping(mappingIndex, fieldIndex, {
													sheetColumn: e.target.value as GoogleSheetsColumnKey
												})
											}
										>
											{GOOGLE_SHEETS_COLUMN_OPTIONS.map((opt) => (
												<option key={opt.value} value={opt.value}>
													{opt.label}
												</option>
											))}
										</Form.Select>
									</td>
									<td className="text-end">
										<Button
											variant="outline-danger"
											size="sm"
											disabled={mapping.fields.length <= 1}
											onClick={() => removeFieldMapping(mappingIndex, fieldIndex)}
										>
											Remove
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</Table>
					<Button
						variant="outline-secondary"
						size="sm"
						onClick={() => addFieldMapping(mappingIndex)}
					>
						Add field mapping
					</Button>
				</div>
			))}

			<Button variant="outline-secondary" size="sm" className="mb-3" onClick={addPieceMapping}>
				Add piece type mapping
			</Button>

			<div className="d-flex flex-wrap gap-2 align-items-center">
				<Button variant="primary" disabled={saving} onClick={() => void saveSheetsSettings()}>
					{saving ? 'Saving…' : 'Save Google Sheets settings'}
				</Button>
				<Button variant="outline-primary" disabled={testing} onClick={() => void runTest()}>
					{testing ? 'Testing…' : 'Test connection'}
				</Button>
			</div>

			{testMessage && (
				<Alert variant={testVariant} className="mt-2 mb-0 py-2 small">
					{testMessage}
				</Alert>
			)}
		</section>
	)
}
