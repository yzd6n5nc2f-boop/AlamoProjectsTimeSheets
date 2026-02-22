import { useNavigate } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { minutesToHoursString } from "../lib/timesheetEngine";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

export function EmployeeDashboardPage() {
  const navigate = useNavigate();
  const { status, periodLabel, revisionNo, computed } = useAppState();

  return (
    <Panel
      title="Employee Dashboard"
      subtitle="Current period overview and quick actions"
      actions={<StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />}
    >
      <div className="metrics-grid">
        <MetricCard label="Period" value={periodLabel} />
        <MetricCard label="Revision" value={String(revisionNo)} />
        <MetricCard label="Normal Hours" value={minutesToHoursString(computed.periodTotals.normalMinutes)} />
        <MetricCard label="Overtime" value={minutesToHoursString(computed.periodTotals.overtimeMinutes)} />
        <MetricCard label="PH Worked" value={minutesToHoursString(computed.periodTotals.phWorkedMinutes)} />
        <MetricCard label="Leave" value={minutesToHoursString(computed.periodTotals.leaveMinutes)} />
      </div>

      <div className="inline-actions">
        <button type="button" className="btn btn-primary" onClick={() => navigate("/timesheet")}>
          Open Timesheet Grid
        </button>
        <button type="button" className="btn" onClick={() => navigate("/history")}>
          View History
        </button>
      </div>
    </Panel>
  );
}
