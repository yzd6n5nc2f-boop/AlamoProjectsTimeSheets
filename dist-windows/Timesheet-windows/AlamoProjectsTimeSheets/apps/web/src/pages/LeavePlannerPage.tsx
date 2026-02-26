import { useMemo, useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { useAppState } from "../state/AppStateContext";

function parseIsoDate(dateValue: string): Date | null {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!pattern.test(dateValue)) {
    return null;
  }

  const [yearText, monthText, dayText] = dateValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

function countWeekdaysInRange(startDate: string, endDate: string): number {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (!start || !end || start > end) {
    return 0;
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let days = 0;

  while (cursor <= end) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) {
      days += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function isInYearRange(startDate: string, endDate: string, year: number): boolean {
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  return startYear <= year && endYear >= year;
}

export function LeavePlannerPage() {
  const {
    leaveSummary,
    plannedLeave,
    addPlannedLeave,
    removePlannedLeave,
    selectedMonth
  } = useAppState();

  const [startDate, setStartDate] = useState(`${selectedMonth}-15`);
  const [endDate, setEndDate] = useState(`${selectedMonth}-15`);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [note, setNote] = useState("Planned annual leave");
  const [message, setMessage] = useState("");

  const previewWorkdays = useMemo(() => countWeekdaysInRange(startDate, endDate), [endDate, startDate]);
  const previewTotalHours = useMemo(() => Number((previewWorkdays * hoursPerDay).toFixed(2)), [hoursPerDay, previewWorkdays]);

  const plannedForYear = useMemo(
    () => plannedLeave.filter((item) => isInYearRange(item.startDate, item.endDate, leaveSummary.year)),
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
          Planned from
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>

        <label className="field">
          Planned to
          <input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>

        <label className="field">
          Hours per day
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={hoursPerDay}
            onChange={(event) => setHoursPerDay(Number(event.target.value) || 0)}
          />
        </label>

        <label className="field">
          Note
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
        </label>
      </div>

      <p className="subtle-note">
        Preview: {previewWorkdays} workday{previewWorkdays === 1 ? "" : "s"} | {previewTotalHours.toFixed(2)} planned hours.
      </p>

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const result = addPlannedLeave({ startDate, endDate, hoursPerDay, note });
            setMessage(result.message);
          }}
        >
          Add Planned Leave Range
        </button>
      </div>

      <div className="table-wrap">
        <table className="table-grid compact">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Workdays</th>
              <th>Hours/Day</th>
              <th>Total Hours</th>
              <th>Note</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {plannedForYear.length === 0 ? (
              <tr>
                <td colSpan={7}>No planned leave records for this year.</td>
              </tr>
            ) : (
              plannedForYear.map((item) => (
                <tr key={item.id}>
                  <td>{item.startDate}</td>
                  <td>{item.endDate}</td>
                  <td>{item.workdays}</td>
                  <td>{item.hoursPerDay.toFixed(2)}</td>
                  <td>{item.totalHours.toFixed(2)}</td>
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
