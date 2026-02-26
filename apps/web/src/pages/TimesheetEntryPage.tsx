import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { minutesToHoursString, sumProjectHours, type DayEntry } from "../lib/timesheetEngine";
import { formatDate, shiftMonthKey, statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

const ABSENCE_OPTIONS = ["", "AL", "SL", "LWOP", "PH"];

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_ENTRY_DAY: "Missing required day entry",
  NEGATIVE_TOTALS: "Totals cannot be negative",
  IMPOSSIBLE_HOURS: "Worked hours exceed policy limits",
  PH_CODE_REQUIRED: "Public holiday not worked must use PH code",
  CODE_HOURS_CONFLICT: "Absence code cannot be combined with worked hours",
  INVALID_ABSENCE_CODE: "Absence code is not allowed",
  PROJECT_DESCRIPTION_REQUIRED: "Project description is required for entered hours"
};

function isEditable(status: string): boolean {
  return status === "DRAFT" || status === "MANAGER_REJECTED";
}

function groupByWorkWeeks(entries: DayEntry[]): Array<{ label: string; entries: DayEntry[] }> {
  const sorted = entries
    .filter((entry) => {
      const weekday = new Date(`${entry.date}T00:00:00`).getDay();
      return weekday !== 0 && weekday !== 6;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const groups: Array<{ label: string; entries: DayEntry[] }> = [];

  let current: DayEntry[] = [];

  for (const entry of sorted) {
    const weekday = new Date(`${entry.date}T00:00:00`).getDay();

    if (current.length === 0) {
      current = [entry];
      continue;
    }

    if (weekday === 1) {
      groups.push({
        label: `Week ${groups.length + 1}`,
        entries: current
      });
      current = [entry];
      continue;
    }

    current.push(entry);
  }

  if (current.length > 0) {
    groups.push({
      label: `Week ${groups.length + 1}`,
      entries: current
    });
  }

  return groups;
}

function buildMonthCalendarDays(monthKey: string): Array<{ date: string; day: number }> {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return [];
  }

  const totalDays = new Date(year, month, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { date, day };
  });
}

export function TimesheetEntryPage() {
  const {
    status,
    dayEntries,
    computed,
    updateDayEntry,
    addProjectLine,
    updateProjectLine,
    removeProjectLine,
    signAsEmployee,
    submitTimesheet,
    selectedMonth,
    setSelectedMonth,
    currentDateIso,
    periodDisplayLabel,
    signatureProfiles,
    employeeSignature,
    sqliteSync
  } = useAppState();
  const [message, setMessage] = useState<string>("");
  const [showMonthCalendar, setShowMonthCalendar] = useState(false);
  const [focusedDate, setFocusedDate] = useState<string>("");
  const navigate = useNavigate();

  const editable = isEditable(status);
  const employeeProfile = signatureProfiles.EMPLOYEE;

  const groupedWeeks = useMemo(() => groupByWorkWeeks(dayEntries), [dayEntries]);
  const monthCalendarDays = useMemo(() => buildMonthCalendarDays(selectedMonth), [selectedMonth]);
  const monthStartWeekday = useMemo(() => new Date(`${selectedMonth}-01T00:00:00`).getDay(), [selectedMonth]);
  const dayEntryDates = useMemo(() => new Set(dayEntries.map((entry) => entry.date)), [dayEntries]);

  const jumpToDate = (date: string) => {
    setFocusedDate(date);
    const row = document.getElementById(`timesheet-day-${date}`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <Panel
      title="Monthly Timesheet Entry"
      subtitle={`Month selected: ${periodDisplayLabel} (Monday-Friday grouped by week)`}
      actions={
        <>
          <StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />
          <StatusChip
            label={
              sqliteSync.state === "error"
                ? "SQLite Error"
                : sqliteSync.state === "saving"
                  ? "SQLite Saving"
                  : sqliteSync.state === "loading"
                    ? "SQLite Loading"
                    : "SQLite Synced"
            }
            tone={sqliteSync.state === "error" ? "bad" : sqliteSync.state === "saving" ? "warn" : "good"}
          />
        </>
      }
    >
      {message ? <p className="alert">{message}</p> : null}
      {sqliteSync.message ? <p className="subtle-note">{sqliteSync.message}</p> : null}

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
            <button type="button" className="btn" onClick={() => setShowMonthCalendar((prior) => !prior)}>
              {showMonthCalendar ? "Hide Month Calendar" : "Open Month Calendar"}
            </button>
          </div>
        </div>
        <label className="field inline-field">
          Current date
          <input value={currentDateIso} readOnly />
        </label>
      </div>

      {showMonthCalendar ? (
        <section className="month-calendar-panel">
          <div className="month-calendar-head">
            <h3>{periodDisplayLabel}</h3>
            <p className="subtle-note">Click a weekday to jump directly to that day row.</p>
          </div>
          <div className="calendar-weekday-row">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
              <span key={weekday} className="calendar-weekday">
                {weekday}
              </span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: monthStartWeekday }, (_, index) => (
              <span key={`offset-${index}`} className="calendar-day-placeholder" aria-hidden="true" />
            ))}
            {monthCalendarDays.map((day) => {
              const hasEntry = dayEntryDates.has(day.date);
              const isCurrentDay = day.date === currentDateIso;
              const isFocusedDay = day.date === focusedDate;
              const className = [
                "calendar-day",
                hasEntry ? "calendar-day-workday" : "calendar-day-weekend",
                isCurrentDay ? "calendar-day-current" : "",
                isFocusedDay ? "calendar-day-focused" : ""
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={day.date}
                  type="button"
                  className={className}
                  disabled={!hasEntry}
                  onClick={() => jumpToDate(day.date)}
                >
                  <span>{day.day}</span>
                  <small>{hasEntry ? "Entry" : "Weekend"}</small>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="signature-panel">
        <div className="signature-panel-head">
          <h3>Employee Electronic Signature</h3>
          <StatusChip label={employeeSignature ? "Employee Signed" : "Signature Required"} tone={employeeSignature ? "good" : "warn"} />
        </div>
        <p className="subtle-note">Sign before submit. Any edit to daily rows clears signatures for this revision.</p>
        {employeeProfile ? (
          <p className="subtle-note">
            Using saved profile: {employeeProfile.fullName} | hash {employeeProfile.profileHash}
          </p>
        ) : (
          <p className="subtle-note">No employee signature profile found. Set it up once and reuse it each month.</p>
        )}
        <div className="inline-actions">
          <button
            type="button"
            className="btn"
            onClick={() => navigate("/signature/setup")}
            disabled={!editable}
          >
            Set Up Signature
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!editable || !employeeProfile}
            onClick={() => {
              const result = signAsEmployee(employeeProfile?.fullName ?? "");
              setMessage(result.message);
            }}
          >
            Electronically Sign
          </button>
        </div>
        {employeeSignature ? (
          <p className="subtle-note">
            Signed by {employeeSignature.signedBy} at {new Date(employeeSignature.signedAt).toLocaleString()} | hash{" "}
            {employeeSignature.signatureHash}
          </p>
        ) : null}
      </section>

      <div className="table-wrap">
        <table className="table-grid">
          <thead>
            <tr>
              <th>Date</th>
              <th>Projects and Hours</th>
              <th>Total Hours</th>
              <th>Absence</th>
              <th>Normal</th>
              <th>OT</th>
              <th>PH Worked</th>
              <th>Leave</th>
              <th>Validation</th>
            </tr>
          </thead>
          <tbody>
            {groupedWeeks.map(({ label, entries }) => {
              const weekDates = new Set(entries.map((entry) => entry.date));
              const weekTotals = entries.reduce(
                (acc, entry) => {
                  const calc = computed.byDate[entry.date];
                  acc.normal += calc?.normalMinutes ?? 0;
                  acc.ot += calc?.overtimeMinutes ?? 0;
                  acc.ph += calc?.phWorkedMinutes ?? 0;
                  acc.leave += calc?.leaveMinutes ?? 0;
                  acc.paid +=
                    (calc?.normalMinutes ?? 0) +
                    (calc?.overtimeMinutes ?? 0) +
                    (calc?.phWorkedMinutes ?? 0) +
                    (calc?.leaveMinutes ?? 0);
                  return acc;
                },
                { normal: 0, ot: 0, ph: 0, leave: 0, paid: 0 }
              );

              return (
                <Fragment key={label}>
                  <tr className="week-divider">
                    <td colSpan={9}>{label}</td>
                  </tr>

                  {entries.map((entry) => {
                    const calc = computed.byDate[entry.date];
                    const errors = calc?.blockingErrors ?? [];
                    const isToday = entry.date === currentDateIso;
                    const totalWorkedHours = sumProjectHours(entry);

                    return (
                      <tr
                        id={`timesheet-day-${entry.date}`}
                        key={entry.date}
                        className={`${errors.length > 0 ? "row-error" : ""} ${isToday ? "row-current" : ""} ${
                          focusedDate === entry.date ? "row-focused" : ""
                        }`.trim()}
                      >
                        <td>{formatDate(entry.date)}</td>
                        <td>
                          <div className="project-lines">
                            {entry.projectLines.length === 0 ? <p className="muted-inline">No project lines</p> : null}
                            {entry.projectLines.map((line) => (
                              <div className="project-line" key={line.id}>
                                <input
                                  value={line.projectDescription}
                                  onChange={(event) =>
                                    updateProjectLine(entry.date, line.id, { projectDescription: event.target.value })
                                  }
                                  placeholder="Project description"
                                  disabled={!editable || entry.absenceCode.length > 0}
                                />
                                <input
                                  value={line.hours}
                                  onChange={(event) =>
                                    updateProjectLine(entry.date, line.id, { hours: Number(event.target.value) || 0 })
                                  }
                                  type="number"
                                  min={0}
                                  max={24}
                                  step={0.25}
                                  disabled={!editable || entry.absenceCode.length > 0}
                                  className="hours-input"
                                />
                                <button
                                  type="button"
                                  className="btn btn-small"
                                  onClick={() => removeProjectLine(entry.date, line.id)}
                                  disabled={!editable || entry.absenceCode.length > 0}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="btn btn-small"
                              onClick={() => addProjectLine(entry.date)}
                              disabled={!editable || entry.absenceCode.length > 0}
                            >
                              + Add Project
                            </button>
                          </div>
                        </td>
                        <td>{totalWorkedHours.toFixed(2)}</td>
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
                    <td colSpan={4}>Weekly Totals ({label})</td>
                    <td>{minutesToHoursString(weekTotals.normal)}</td>
                    <td>{minutesToHoursString(weekTotals.ot)}</td>
                    <td>{minutesToHoursString(weekTotals.ph)}</td>
                    <td>{minutesToHoursString(weekTotals.leave)}</td>
                    <td>{minutesToHoursString(weekTotals.paid)} paid</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="row-total period-total">
              <td colSpan={4}>Month Totals</td>
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
          disabled={!editable || !employeeSignature}
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
