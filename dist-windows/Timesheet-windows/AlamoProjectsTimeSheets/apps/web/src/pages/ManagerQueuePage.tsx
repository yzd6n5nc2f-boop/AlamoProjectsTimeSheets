import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { minutesToHoursString, type WorkflowStatus } from "../lib/timesheetEngine";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

interface QueueRow {
  employeeId: string;
  employeeName: string;
  period: string;
  status: WorkflowStatus;
  normalMinutes: number;
  overtimeMinutes: number;
  phWorkedMinutes: number;
}

const STATUS_CYCLE: WorkflowStatus[] = [
  "SUBMITTED",
  "DRAFT",
  "MANAGER_APPROVED",
  "PAYROLL_VALIDATED",
  "MANAGER_REJECTED",
  "LOCKED"
];

const PAGE_SIZE = 12;

function buildQueueRows(
  count: number,
  period: string,
  baseTotals: { normalMinutes: number; overtimeMinutes: number; phWorkedMinutes: number },
  currentStatus: WorkflowStatus
): QueueRow[] {
  return Array.from({ length: count }, (_, index) => {
    const status = index === 0 ? currentStatus : (STATUS_CYCLE[index % STATUS_CYCLE.length] ?? "SUBMITTED");
    const employeeNumber = 1001 + index;
    const variation = ((index % 7) - 3) * 45;
    const overtimeVariation = ((index % 5) - 2) * 20;
    const phVariation = index % 9 === 0 ? 120 : 0;

    return {
      employeeId: `E${employeeNumber}`,
      employeeName: `Employee ${employeeNumber}`,
      period,
      status,
      normalMinutes: Math.max(0, baseTotals.normalMinutes + variation),
      overtimeMinutes: Math.max(0, baseTotals.overtimeMinutes + overtimeVariation),
      phWorkedMinutes: Math.max(0, baseTotals.phWorkedMinutes + phVariation)
    };
  });
}

export function ManagerQueuePage() {
  const navigate = useNavigate();
  const { status, periodDisplayLabel, computed } = useAppState();
  const [teamSize, setTeamSize] = useState<number>(100);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "ALL">("ALL");
  const [page, setPage] = useState<number>(1);

  const queueRows = useMemo(
    () =>
      buildQueueRows(
        Math.min(300, Math.max(1, Math.floor(teamSize || 1))),
        periodDisplayLabel,
        computed.periodTotals,
        status
      ),
    [computed.periodTotals, periodDisplayLabel, status, teamSize]
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return queueRows.filter((row) => {
      const statusMatch = statusFilter === "ALL" || row.status === statusFilter;
      if (!statusMatch) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      return (
        row.employeeName.toLowerCase().includes(normalizedSearch) ||
        row.employeeId.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [queueRows, search, statusFilter]);

  const statusCounts = useMemo(() => {
    return filteredRows.reduce<Record<WorkflowStatus, number>>(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      {
        DRAFT: 0,
        SUBMITTED: 0,
        MANAGER_APPROVED: 0,
        MANAGER_REJECTED: 0,
        PAYROLL_VALIDATED: 0,
        LOCKED: 0
      }
    );
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * PAGE_SIZE;
  const pagedRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <Panel title="Manager Queue" subtitle="Queue preview with search and pagination for large teams">
      <div className="queue-toolbar">
        <label className="field inline-field">
          Team size
          <input
            type="number"
            min={1}
            max={300}
            value={teamSize}
            onChange={(event) => setTeamSize(Number(event.target.value) || 1)}
          />
        </label>
        <label className="field">
          Search employee
          <input
            placeholder="Name or employee ID"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field inline-field">
          Status filter
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as WorkflowStatus | "ALL");
              setPage(1);
            }}
          >
            <option value="ALL">All</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="MANAGER_APPROVED">Manager Approved</option>
            <option value="MANAGER_REJECTED">Manager Rejected</option>
            <option value="PAYROLL_VALIDATED">Payroll Validated</option>
            <option value="LOCKED">Locked</option>
          </select>
        </label>
      </div>

      <div className="queue-status-summary">
        <StatusChip label={`Submitted ${statusCounts.SUBMITTED}`} tone="info" />
        <StatusChip label={`Draft ${statusCounts.DRAFT}`} tone="neutral" />
        <StatusChip label={`Approved ${statusCounts.MANAGER_APPROVED}`} tone="good" />
        <StatusChip label={`Rejected ${statusCounts.MANAGER_REJECTED}`} tone="bad" />
        <StatusChip label={`Locked ${statusCounts.LOCKED}`} tone="warn" />
      </div>

      <p className="subtle-note">
        Showing {filteredRows.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredRows.length)} of{" "}
        {filteredRows.length} employees.
      </p>

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
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={7}>No employees match the current filters.</td>
              </tr>
            ) : (
              pagedRows.map((row) => {
                const actionable = row.status === "SUBMITTED";

                return (
                  <tr key={row.employeeId}>
                    <td>
                      {row.employeeName} ({row.employeeId})
                    </td>
                    <td>{row.period}</td>
                    <td>
                      <StatusChip label={row.status.replaceAll("_", " ")} tone={statusTone(row.status)} />
                    </td>
                    <td>{minutesToHoursString(row.normalMinutes)}</td>
                    <td>{minutesToHoursString(row.overtimeMinutes)}</td>
                    <td>{minutesToHoursString(row.phWorkedMinutes)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!actionable}
                        onClick={() => navigate("/manager/review")}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="inline-actions">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((prior) => Math.max(1, prior - 1))}>
          Previous Page
        </button>
        <StatusChip label={`Page ${page} of ${totalPages}`} tone="neutral" />
        <button
          type="button"
          className="btn"
          disabled={page >= totalPages}
          onClick={() => setPage((prior) => Math.min(totalPages, prior + 1))}
        >
          Next Page
        </button>
      </div>
    </Panel>
  );
}
