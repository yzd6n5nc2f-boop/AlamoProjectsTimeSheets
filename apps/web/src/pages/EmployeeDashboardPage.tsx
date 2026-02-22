import { useNavigate } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
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

  return (
    <Panel
      title="Employee Dashboard"
      subtitle="Month-by-month timesheet summary and quick actions"
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

      <div className="metrics-grid">
        <MetricCard label="Current Date" value={currentDateIso} />
        <MetricCard label="Selected Month" value={periodDisplayLabel} />
        <MetricCard label="Period Key" value={periodLabel} />
        <MetricCard label="Revision" value={String(revisionNo)} />
        <MetricCard label="Normal Hours" value={minutesToHoursString(computed.periodTotals.normalMinutes)} />
        <MetricCard label="Overtime" value={minutesToHoursString(computed.periodTotals.overtimeMinutes)} />
        <MetricCard label="Leave" value={minutesToHoursString(computed.periodTotals.leaveMinutes)} />
        <MetricCard label="Annual Leave Remaining" value={leaveSummary.remainingAfterPlanned.toFixed(2)} />
      </div>

      <div className="inline-actions">
        <button type="button" className="btn btn-primary" onClick={() => navigate("/timesheet")}>
          Open Monthly Timesheet
        </button>
        <button type="button" className="btn" onClick={() => navigate("/leave/planner")}>
          Open Leave Planner
        </button>
        <button type="button" className="btn" onClick={() => navigate("/history")}>
          View History
        </button>
      </div>
    </Panel>
  );
}
