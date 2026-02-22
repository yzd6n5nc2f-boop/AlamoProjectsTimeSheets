import { useNavigate } from "react-router-dom";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { minutesToHoursString } from "../lib/timesheetEngine";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

export function ManagerQueuePage() {
  const navigate = useNavigate();
  const { status, periodLabel, computed } = useAppState();

  const actionable = status === "SUBMITTED";

  return (
    <Panel title="Manager Queue" subtitle="Fast approval queue optimized for speed">
      <div className="table-wrap">
        <table className="table-grid">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Period</th>
              <th>Status</th>
              <th>Normal</th>
              <th>OT</th>
              <th>PH Worked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ana Lee (E1001)</td>
              <td>{periodLabel}</td>
              <td>
                <StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />
              </td>
              <td>{minutesToHoursString(computed.periodTotals.normalMinutes)}</td>
              <td>{minutesToHoursString(computed.periodTotals.overtimeMinutes)}</td>
              <td>{minutesToHoursString(computed.periodTotals.phWorkedMinutes)}</td>
              <td>
                <button type="button" className="btn btn-primary" disabled={!actionable} onClick={() => navigate("/manager/review")}>
                  Review
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
