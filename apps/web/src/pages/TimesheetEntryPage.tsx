import { Fragment, useMemo, useState } from "react";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { formatDate, shiftMonthKey, statusTone } from "../lib/ui";
import { minutesToHoursString } from "../lib/timesheetEngine";
import { useAppState } from "../state/AppStateContext";

const ABSENCE_OPTIONS = ["", "AL", "SL", "LWOP", "PH"];

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_ENTRY_DAY: "Missing required day entry",
  NEGATIVE_TOTALS: "Totals cannot be negative",
  IMPOSSIBLE_HOURS: "Worked hours exceed policy limits",
  PH_CODE_REQUIRED: "Public holiday not worked must use PH code",
  CODE_HOURS_CONFLICT: "Absence code cannot be combined with worked hours",
  INVALID_ABSENCE_CODE: "Absence code is not allowed",
  PROJECT_REQUIRED: "Project description is required when hours are entered"
};

function isEditable(status: string): boolean {
  return status === "DRAFT" || status === "MANAGER_REJECTED";
}

export function TimesheetEntryPage() {
  const {
    status,
    dayEntries,
    computed,
    updateDayEntry,
    submitTimesheet,
    selectedMonth,
    setSelectedMonth,
    currentDateIso,
    periodDisplayLabel
  } = useAppState();
  const [message, setMessage] = useState<string>("");

  const editable = isEditable(status);

  const groupedByWeek = useMemo(() => {
    const map = new Map<string, typeof dayEntries>();
    for (const entry of dayEntries) {
      const date = new Date(`${entry.date}T00:00:00`);
      const yearStart = new Date(date.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((date.getTime() - yearStart.getTime()) / 86400000) + 1;
      const week = `${date.getFullYear()}-W${String(Math.ceil(dayOfYear / 7)).padStart(2, "0")}`;
      map.set(week, [...(map.get(week) ?? []), entry]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dayEntries]);

  return (
    <Panel
      title="Monthly Timesheet Entry"
      subtitle={`Month selected: ${periodDisplayLabel} (work week rows only)`}
      actions={<StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />}
    >
      {message ? <p className="alert">{message}</p> : null}

      <div className="form-grid">
        <div className="field">
          <span>Select month</span>
          <div className="month-switcher">
            <button type="button" className="btn" onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}>
              Previous Month
            </button>
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
            <button type="button" className="btn" onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}>
              Next Month
            </button>
          </div>
        </div>
        <label className="field inline-field">
          Current date
          <input value={currentDateIso} readOnly />
        </label>
      </div>

      <div className="table-wrap">
        <table className="table-grid">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day Type</th>
              <th>Project Description</th>
              <th>Hours</th>
              <th>Absence</th>
              <th>Normal</th>
              <th>OT</th>
              <th>PH Worked</th>
              <th>Leave</th>
              <th>Validation</th>
            </tr>
          </thead>
          <tbody>
            {groupedByWeek.map(([weekLabel, entries]) => {
              const weekTotals = computed.weekly.find((item) => item.weekLabel === weekLabel)?.totals;

              return (
                <Fragment key={weekLabel}>
                  {entries.map((entry) => {
                    const calc = computed.byDate[entry.date];
                    const errors = calc?.blockingErrors ?? [];
                    const isToday = entry.date === currentDateIso;

                    return (
                      <tr
                        key={entry.date}
                        className={`${errors.length > 0 ? "row-error" : ""} ${isToday ? "row-current" : ""}`.trim()}
                      >
                        <td>{formatDate(entry.date)}</td>
                        <td>{entry.dayType}</td>
                        <td>
                          <input
                            value={entry.projectDescription}
                            onChange={(event) => updateDayEntry(entry.date, { projectDescription: event.target.value })}
                            placeholder="Project or task description"
                            disabled={!editable || entry.absenceCode.length > 0}
                          />
                        </td>
                        <td>
                          <input
                            value={entry.hoursWorked}
                            onChange={(event) => updateDayEntry(entry.date, { hoursWorked: Number(event.target.value) || 0 })}
                            type="number"
                            min={0}
                            max={24}
                            step={0.25}
                            disabled={!editable || entry.absenceCode.length > 0}
                          />
                        </td>
                        <td>
                          <select
                            value={entry.absenceCode}
                            onChange={(event) => updateDayEntry(entry.date, { absenceCode: event.target.value })}
                            disabled={!editable}
                          >
                            {ABSENCE_OPTIONS.map((option) => (
                              <option value={option} key={option || "none"}>
                                {option || "--"}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{minutesToHoursString(calc?.normalMinutes ?? 0)}</td>
                        <td>{minutesToHoursString(calc?.overtimeMinutes ?? 0)}</td>
                        <td>{minutesToHoursString(calc?.phWorkedMinutes ?? 0)}</td>
                        <td>{minutesToHoursString(calc?.leaveMinutes ?? 0)}</td>
                        <td>
                          {errors.length === 0 ? (
                            <StatusChip label="OK" tone="good" />
                          ) : (
                            <ul className="error-list">
                              {errors.map((errorCode) => (
                                <li key={errorCode}>{ERROR_MESSAGES[errorCode] ?? errorCode}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="row-total">
                    <td colSpan={5}>Weekly Totals ({weekLabel})</td>
                    <td>{minutesToHoursString(weekTotals?.normalMinutes ?? 0)}</td>
                    <td>{minutesToHoursString(weekTotals?.overtimeMinutes ?? 0)}</td>
                    <td>{minutesToHoursString(weekTotals?.phWorkedMinutes ?? 0)}</td>
                    <td>{minutesToHoursString(weekTotals?.leaveMinutes ?? 0)}</td>
                    <td>{minutesToHoursString(weekTotals?.paidMinutes ?? 0)} paid</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="row-total period-total">
              <td colSpan={5}>Month Totals</td>
              <td>{minutesToHoursString(computed.periodTotals.normalMinutes)}</td>
              <td>{minutesToHoursString(computed.periodTotals.overtimeMinutes)}</td>
              <td>{minutesToHoursString(computed.periodTotals.phWorkedMinutes)}</td>
              <td>{minutesToHoursString(computed.periodTotals.leaveMinutes)}</td>
              <td>{minutesToHoursString(computed.periodTotals.paidMinutes)} paid</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!editable}
          onClick={() => {
            const result = submitTimesheet();
            setMessage(result.message);
          }}
        >
          Submit Monthly Timesheet
        </button>
      </div>
    </Panel>
  );
}
