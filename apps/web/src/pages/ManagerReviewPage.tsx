import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { minutesToHoursString, sumProjectHours } from "../lib/timesheetEngine";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

export function ManagerReviewPage() {
  const {
    status,
    computed,
    managerNote,
    setManagerNote,
    employeeSignature,
    managerSignature,
    signatureProfiles,
    signAsManager,
    managerApprove,
    managerReject,
    dayEntries,
    periodDisplayLabel
  } = useAppState();
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const canDecide = status === "SUBMITTED";
  const managerProfile = signatureProfiles.MANAGER;

  return (
    <Panel
      title="Manager Review Detail"
      subtitle={`Review monthly entries for ${periodDisplayLabel}`}
      actions={<StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />}
    >
      {message ? <p className="alert">{message}</p> : null}

      <div className="metrics-grid">
        <div className="metric-card">
          <p>Overtime</p>
          <strong>{minutesToHoursString(computed.periodTotals.overtimeMinutes)}</strong>
        </div>
        <div className="metric-card">
          <p>PH Worked</p>
          <strong>{minutesToHoursString(computed.periodTotals.phWorkedMinutes)}</strong>
        </div>
        <div className="metric-card">
          <p>Blocking Exceptions</p>
          <strong>{String(computed.exceptions.filter((item) => item.severity === "ERROR").length)}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table-grid compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Projects</th>
              <th>Total Hours</th>
              <th>Absence</th>
            </tr>
          </thead>
          <tbody>
            {dayEntries.map((entry) => (
              <tr key={entry.date}>
                <td>{entry.date}</td>
                <td>
                  {entry.projectLines.length === 0
                    ? "--"
                    : entry.projectLines
                        .filter((line) => line.hours > 0 || line.projectDescription.trim().length > 0)
                        .map((line) => `${line.projectDescription || "(No description)"} (${line.hours.toFixed(2)}h)`)
                        .join(", ") || "--"}
                </td>
                <td>{sumProjectHours(entry).toFixed(2)}</td>
                <td>{entry.absenceCode || "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="signature-panel">
        <div className="signature-panel-head">
          <h3>Electronic Signatures</h3>
          <div className="signature-chip-row">
            <StatusChip label={employeeSignature ? "Employee Signed" : "Employee Missing"} tone={employeeSignature ? "good" : "bad"} />
            <StatusChip label={managerSignature ? "Manager Signed" : "Manager Missing"} tone={managerSignature ? "good" : "warn"} />
          </div>
        </div>
        {employeeSignature ? (
          <p className="subtle-note">
            Employee: {employeeSignature.signedBy} at {new Date(employeeSignature.signedAt).toLocaleString()} | hash{" "}
            {employeeSignature.signatureHash}
          </p>
        ) : (
          <p className="subtle-note">Employee must electronically sign before manager can sign.</p>
        )}
        {managerProfile ? (
          <p className="subtle-note">
            Using saved profile: {managerProfile.fullName} | hash {managerProfile.profileHash}
          </p>
        ) : (
          <p className="subtle-note">No manager signature profile found. Set it up once and reuse it for approvals.</p>
        )}
        <div className="inline-actions">
          <button type="button" className="btn" onClick={() => navigate("/signature/setup")}>
            Set Up Signature
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canDecide || !managerProfile}
            onClick={() => {
              const result = signAsManager(managerProfile?.fullName ?? "");
              setMessage(result.message);
            }}
          >
            Manager Electronic Sign
          </button>
        </div>
        {managerSignature ? (
          <p className="subtle-note">
            Manager: {managerSignature.signedBy} at {new Date(managerSignature.signedAt).toLocaleString()} | hash{" "}
            {managerSignature.signatureHash}
          </p>
        ) : null}
      </section>

      <label className="field">
        Manager decision note
        <textarea
          value={managerNote}
          onChange={(event) => setManagerNote(event.target.value)}
          placeholder="Required for reject; used to confirm OT/PH decisions"
          rows={3}
          disabled={!canDecide}
        />
      </label>

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canDecide || !managerSignature}
          onClick={() => {
            const result = managerApprove();
            setMessage(result.message);
          }}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={!canDecide}
          onClick={() => {
            const result = managerReject();
            setMessage(result.message);
          }}
        >
          Reject
        </button>
      </div>
    </Panel>
  );
}
