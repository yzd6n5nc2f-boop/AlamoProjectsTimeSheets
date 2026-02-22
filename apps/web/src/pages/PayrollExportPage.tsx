import { useState } from "react";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

export function PayrollExportPage() {
  const { status, exportBatches, createExportBatch } = useAppState();
  const [message, setMessage] = useState("");

  const canExport = status === "PAYROLL_VALIDATED" || status === "LOCKED";

  return (
    <Panel
      title="Payroll Export"
      subtitle="Create deterministic export batches with traceable checksum"
      actions={<StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />}
    >
      {message ? <p className="alert">{message}</p> : null}

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canExport}
          onClick={() => {
            const result = createExportBatch();
            setMessage(result.message);
          }}
        >
          Create Export Batch
        </button>
      </div>

      <div className="table-wrap">
        <table className="table-grid">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Created At</th>
              <th>Lines</th>
              <th>Checksum</th>
            </tr>
          </thead>
          <tbody>
            {exportBatches.length === 0 ? (
              <tr>
                <td colSpan={4}>No batches generated yet.</td>
              </tr>
            ) : (
              exportBatches.map((batch) => (
                <tr key={batch.batchId}>
                  <td>{batch.batchId}</td>
                  <td>{new Date(batch.createdAt).toLocaleString()}</td>
                  <td>{batch.lineCount}</td>
                  <td>{batch.checksum}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
