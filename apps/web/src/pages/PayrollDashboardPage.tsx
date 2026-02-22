import { useMemo, useState } from "react";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

export function PayrollDashboardPage() {
  const { status, computed, payrollValidate, lockPeriod } = useAppState();
  const [severity, setSeverity] = useState<"ALL" | "ERROR" | "WARNING">("ALL");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    if (severity === "ALL") {
      return computed.exceptions;
    }
    return computed.exceptions.filter((item) => item.severity === severity);
  }, [computed.exceptions, severity]);

  const exportReady = status === "PAYROLL_VALIDATED" || status === "LOCKED";

  return (
    <Panel
      title="Payroll Validation Dashboard"
      subtitle="Exception-focused validation and export readiness"
      actions={<StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />}
    >
      {message ? <p className="alert">{message}</p> : null}

      <div className="metrics-grid">
        <div className="metric-card">
          <p>Blocking Errors</p>
          <strong>{String(computed.exceptions.filter((item) => item.severity === "ERROR").length)}</strong>
        </div>
        <div className="metric-card">
          <p>Warnings</p>
          <strong>{String(computed.exceptions.filter((item) => item.severity === "WARNING").length)}</strong>
        </div>
        <div className="metric-card">
          <p>Export Readiness</p>
          <strong>{exportReady ? "Ready" : "Not Ready"}</strong>
        </div>
      </div>

      <label className="field inline-field">
        Severity filter
        <select value={severity} onChange={(event) => setSeverity(event.target.value as "ALL" | "ERROR" | "WARNING")}> 
          <option value="ALL">All</option>
          <option value="ERROR">Error</option>
          <option value="WARNING">Warning</option>
        </select>
      </label>

      <div className="table-wrap">
        <table className="table-grid compact">
          <thead>
            <tr>
              <th>Code</th>
              <th>Severity</th>
              <th>Date</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4}>No exceptions for selected filter.</td>
              </tr>
            ) : (
              filtered.map((exception) => (
                <tr key={`${exception.code}-${exception.date ?? "na"}`}>
                  <td>{exception.code}</td>
                  <td>
                    <StatusChip label={exception.severity} tone={exception.severity === "ERROR" ? "bad" : "warn"} />
                  </td>
                  <td>{exception.date ?? "--"}</td>
                  <td>{exception.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={status !== "MANAGER_APPROVED"}
          onClick={() => {
            const result = payrollValidate();
            setMessage(result.message);
          }}
        >
          Mark Payroll Validated
        </button>

        <button
          type="button"
          className="btn"
          disabled={status !== "PAYROLL_VALIDATED"}
          onClick={() => {
            const result = lockPeriod();
            setMessage(result.message);
          }}
        >
          Lock Period
        </button>
      </div>
    </Panel>
  );
}
