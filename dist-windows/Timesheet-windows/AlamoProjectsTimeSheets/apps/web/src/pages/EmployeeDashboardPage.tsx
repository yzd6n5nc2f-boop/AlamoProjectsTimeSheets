import { useNavigate } from "react-router-dom";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { minutesToHoursString } from "../lib/timesheetEngine";
import { shiftMonthKey, statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

export function EmployeeDashboardPage() {
  const navigate = useNavigate();
  const {
    status,
    periodLabel,
    periodDisplayLabel,
    revisionNo,
    computed,
    selectedMonth,
    setSelectedMonth,
    currentDateIso,
    leaveSummary
  } = useAppState();

  const leaveStatusTone =
    leaveSummary.remainingAfterPlanned < 0 ? "bad" : leaveSummary.remainingAfterPlanned < 16 ? "warn" : "good";
  const leaveStatusLabel =
    leaveSummary.remainingAfterPlanned < 0
      ? "Over Planned"
      : leaveSummary.remainingAfterPlanned < 16
        ? "Low Balance"
        : "On Track";

  return (
    <Panel
      title="Employee Dashboard"
      subtitle="Month-by-month summary with quick access to timesheet and leave"
      actions={<StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />}
    >
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
      </div>

      <div className="dashboard-summary-row">
        <span>
          Current Date <strong>{currentDateIso}</strong>
        </span>
        <span>
          Month <strong>{periodDisplayLabel}</strong>
        </span>
        <span>
          Period Key <strong>{periodLabel}</strong>
        </span>
        <span>
          Revision <strong>{revisionNo}</strong>
        </span>
        <span>
          Leave Status <StatusChip label={leaveStatusLabel} tone={leaveStatusTone} />
        </span>
      </div>

      <div className="dashboard-summary-metrics">
        <div className="dashboard-summary-metric">
          <p>Normal</p>
          <strong>{minutesToHoursString(computed.periodTotals.normalMinutes)}h</strong>
        </div>
        <div className="dashboard-summary-metric">
          <p>Overtime</p>
          <strong>{minutesToHoursString(computed.periodTotals.overtimeMinutes)}h</strong>
        </div>
        <div className="dashboard-summary-metric">
          <p>Leave</p>
          <strong>{minutesToHoursString(computed.periodTotals.leaveMinutes)}h</strong>
        </div>
        <div className="dashboard-summary-metric">
          <p>Annual Leave Remaining</p>
          <strong>{leaveSummary.remainingAfterPlanned.toFixed(2)}h</strong>
        </div>
      </div>

      <div className="inline-actions">
        <button type="button" className="btn btn-primary" onClick={() => navigate("/timesheet")}>
          Open Monthly Timesheet
        </button>
        <button type="button" className="btn" onClick={() => navigate("/leave/planner")}>
          Open Leave Planner
        </button>
        <button type="button" className="btn" onClick={() => navigate("/history")}>
          View Status
        </button>
        <button type="button" className="btn" onClick={() => navigate("/signature/setup")}>
          Signature Setup
        </button>
      </div>
    </Panel>
  );
}
