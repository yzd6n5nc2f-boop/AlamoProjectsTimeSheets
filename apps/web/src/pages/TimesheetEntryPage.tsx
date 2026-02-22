import { Fragment, useMemo, useState } from "react";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { formatDate, statusTone } from "../lib/ui";
import { minutesToHoursString } from "../lib/timesheetEngine";
import { useAppState } from "../state/AppStateContext";

const ABSENCE_OPTIONS = ["", "AL", "SL", "LWOP", "PH"];

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_ENTRY_DAY: "Missing required day entry",
  TIME_PAIR_REQUIRED: "Start and finish must both be set",
  FINISH_BEFORE_START: "Finish must be after start",
  NEGATIVE_TOTALS: "Totals cannot be negative",
  IMPOSSIBLE_HOURS: "Worked hours exceed policy limits",
  PH_CODE_REQUIRED: "Public holiday not worked must use PH code",
  CODE_TIME_CONFLICT: "Absence code cannot be combined with start/finish",
  INVALID_TIME_FORMAT: "Time format must be HH:mm",
  INVALID_ABSENCE_CODE: "Absence code is not allowed"
};

function isEditable(status: string): boolean {
  return status === "DRAFT" || status === "MANAGER_REJECTED";
}

export function TimesheetEntryPage() {
  const { status, dayEntries, computed, updateDayEntry, submitTimesheet } = useAppState();
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
      title="Timesheet Entry Grid"
      subtitle="Paper-like daily grid with deterministic validation and totals"
      actions={<StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />}
    >
      {message ? <p className="alert">{message}</p> : null}

      <div className="table-wrap">
        <table className="table-grid">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day Type</th>
              <th>Start</th>
              <th>Finish</th>
              <th>Break</th>
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

                    return (
                      <tr key={entry.date} className={errors.length > 0 ? "row-error" : ""}>
                        <td>{formatDate(entry.date)}</td>
                        <td>{entry.dayType}</td>
                        <td>
                          <input
                            value={entry.startLocal}
                            onChange={(event) => updateDayEntry(entry.date, { startLocal: event.target.value })}
                            placeholder="08:00"
                            disabled={!editable || entry.absenceCode.length > 0}
                          />
                        </td>
                        <td>
                          <input
                            value={entry.endLocal}
                            onChange={(event) => updateDayEntry(entry.date, { endLocal: event.target.value })}
                            placeholder="16:30"
                            disabled={!editable || entry.absenceCode.length > 0}
                          />
                        </td>
                        <td>
                          <input
                            value={entry.breakMinutes}
                            onChange={(event) => updateDayEntry(entry.date, { breakMinutes: Number(event.target.value) || 0 })}
                            type="number"
                            min={0}
                            max={120}
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
                    <td colSpan={6}>Weekly Totals ({weekLabel})</td>
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
              <td colSpan={6}>Period Totals</td>
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
          Submit Timesheet
        </button>
      </div>
    </Panel>
  );
}
