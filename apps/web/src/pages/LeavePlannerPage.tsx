import { useMemo, useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { useAppState } from "../state/AppStateContext";

export function LeavePlannerPage() {
  const {
    leaveSummary,
    plannedLeave,
    addPlannedLeave,
    removePlannedLeave,
    selectedMonth
  } = useAppState();

  const [date, setDate] = useState(`${selectedMonth}-15`);
  const [hours, setHours] = useState(8);
  const [note, setNote] = useState("Planned annual leave");
  const [message, setMessage] = useState("");

  const plannedForYear = useMemo(
    () => plannedLeave.filter((item) => item.date.startsWith(`${leaveSummary.year}-`)),
    [leaveSummary.year, plannedLeave]
  );

  return (
    <Panel
      title="Leave Planner"
      subtitle="Record planned annual leave and track yearly balance"
      actions={<StatusChip label={`${leaveSummary.year} Leave`} tone="info" />}
    >
      {message ? <p className="alert">{message}</p> : null}

      <div className="metrics-grid">
        <MetricCard label="Entitlement (hours)" value={leaveSummary.entitlementHours.toFixed(2)} />
        <MetricCard label="Taken (hours)" value={leaveSummary.takenHours.toFixed(2)} />
        <MetricCard label="Planned (hours)" value={leaveSummary.plannedHours.toFixed(2)} />
        <MetricCard label="Remaining After Taken" value={leaveSummary.remainingAfterTaken.toFixed(2)} />
        <MetricCard label="Remaining After Planned" value={leaveSummary.remainingAfterPlanned.toFixed(2)} />
      </div>

      <div className="form-grid">
        <label className="field">
          Planned date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <label className="field">
          Planned hours
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value) || 0)}
          />
        </label>

        <label className="field">
          Note
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
        </label>
      </div>

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const result = addPlannedLeave({ date, hours, note });
            setMessage(result.message);
          }}
        >
          Add Planned Leave
        </button>
      </div>

      <div className="table-wrap">
        <table className="table-grid compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Hours</th>
              <th>Note</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {plannedForYear.length === 0 ? (
              <tr>
                <td colSpan={4}>No planned leave records for this year.</td>
              </tr>
            ) : (
              plannedForYear.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td>{item.hours.toFixed(2)}</td>
                  <td>{item.note || "--"}</td>
                  <td>
                    <button type="button" className="btn" onClick={() => removePlannedLeave(item.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
