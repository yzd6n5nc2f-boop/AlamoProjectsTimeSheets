import { Panel } from "../components/Panel";
import { useAppState } from "../state/AppStateContext";

const BALANCES = [
  { employee: "Ana Lee", code: "AL", hours: 40 },
  { employee: "Ana Lee", code: "SL", hours: 24 },
  { employee: "Marta Ng", code: "AL", hours: 56 },
  { employee: "Paul Tran", code: "AL", hours: 32 }
];

const LEDGER = [
  { date: "2026-02-01", employee: "Ana Lee", code: "AL", delta: "+2.00h", reason: "Accrual" },
  { date: "2026-02-10", employee: "Ana Lee", code: "PH", delta: "-8.00h", reason: "PH not worked" },
  { date: "2026-02-12", employee: "Marta Ng", code: "SL", delta: "-4.00h", reason: "Sick leave half day" }
];

export function LeaveAdminPage() {
  const { ruleSettings } = useAppState();

  return (
    <Panel title="Leave Admin" subtitle="Leave balances and immutable ledger view">
      <p>Current leave paid default: {ruleSettings.leavePaidMinutesDefault / 60} hours per day.</p>

      <div className="table-wrap">
        <table className="table-grid compact">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Code</th>
              <th>Balance (hours)</th>
            </tr>
          </thead>
          <tbody>
            {BALANCES.map((row) => (
              <tr key={`${row.employee}-${row.code}`}>
                <td>{row.employee}</td>
                <td>{row.code}</td>
                <td>{row.hours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="table-grid compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Code</th>
              <th>Delta</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {LEDGER.map((row) => (
              <tr key={`${row.date}-${row.employee}-${row.code}`}>
                <td>{row.date}</td>
                <td>{row.employee}</td>
                <td>{row.code}</td>
                <td>{row.delta}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
