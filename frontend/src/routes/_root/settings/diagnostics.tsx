import { createFileRoute } from '@tanstack/react-router'
import { Alert, Table } from 'react-bootstrap'
import { CoreDiagnosticsChip } from '~/components/rundown/coreDiagnosticsChip'
import { useCoreDiagnostics } from '~/hooks/useCoreDiagnostics'

export const Route = createFileRoute('/_root/settings/diagnostics')({
	component: RouteComponent
})

function RouteComponent() {
	const { diagnostics, loading, error, refresh } = useCoreDiagnostics()

	return (
		<>
			<div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
				<h2 className="mb-0">Core diagnostics</h2>
				<div className="d-flex align-items-center gap-2">
					<CoreDiagnosticsChip />
					<button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void refresh()}>
						Refresh
					</button>
				</div>
			</div>

			<p className="text-muted">
				This probe checks whether Sofie Core is reachable, this Rundown Editor peripheral device
				is attached to a studio, and Core&apos;s rundown content-status API responds. A green
				result does <strong>not</strong> mean Package Manager itself is connected — PM can be
				offline while this call still succeeds (pieces would simply show not-ready).
			</p>

			{loading && !diagnostics && <p>Loading…</p>}
			{error && <Alert variant="danger">{error}</Alert>}

			{diagnostics && (
				<Table bordered size="sm" className="w-auto">
					<tbody>
						<tr>
							<th scope="row">Core connection</th>
							<td>
								{diagnostics.connection.status}
								{diagnostics.connection.url
									? ` (${diagnostics.connection.url}:${diagnostics.connection.port ?? ''})`
									: ''}
							</td>
						</tr>
						<tr>
							<th scope="row">Device ID configured</th>
							<td>{diagnostics.deviceAuth.deviceIdConfigured ? 'Yes' : 'No (default SofieRundownEditor)'}</td>
						</tr>
						<tr>
							<th scope="row">Using unsecureToken</th>
							<td>{diagnostics.deviceAuth.usingUnsecureToken ? 'Yes' : 'No'}</td>
						</tr>
						<tr>
							<th scope="row">Content-status probe</th>
							<td>{diagnostics.contentStatusProbe.summary}</td>
						</tr>
						{diagnostics.contentStatusProbe.operatorLabel && (
							<tr>
								<th scope="row">Failure class</th>
								<td>{diagnostics.contentStatusProbe.operatorLabel}</td>
							</tr>
						)}
						<tr>
							<th scope="row">Checked at</th>
							<td>
								<code>{diagnostics.contentStatusProbe.checkedAt}</code>
								<span className="text-muted ms-2">(shared across browsers within ~8s TTL)</span>
							</td>
						</tr>
					</tbody>
				</Table>
			)}
		</>
	)
}
