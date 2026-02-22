import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Page } from "./pages/Page";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Page title="Login" description="Authenticate to Timesheet." />} />
        <Route
          path="/employee"
          element={<Page title="Employee Dashboard" description="View period status and quick actions." />}
        />
        <Route
          path="/timesheet"
          element={<Page title="Timesheet Entry Grid" description="Paper-like daily grid with deterministic totals." />}
        />
        <Route
          path="/history"
          element={<Page title="History" description="Historical revisions, approvals, and export linkage." />}
        />
        <Route
          path="/manager/queue"
          element={<Page title="Manager Queue" description="Speed-optimised approval queue with status chips." />}
        />
        <Route
          path="/manager/review"
          element={<Page title="Manager Review Detail" description="Review submitted rows and approve or reject with notes." />}
        />
        <Route
          path="/payroll/dashboard"
          element={<Page title="Payroll Dashboard" description="Exception-first validation and export readiness checks." />}
        />
        <Route
          path="/payroll/export"
          element={<Page title="Payroll Export" description="Generate deterministic CSV/XLSX export batches." />}
        />
        <Route
          path="/admin/rules"
          element={<Page title="Admin Calendar and Rules" description="Manage effective-dated rules, holidays, and paid-hours policies." />}
        />
        <Route
          path="/admin/leave"
          element={<Page title="Leave Admin" description="Manage leave codes, balances, and ledger integrity." />}
        />
      </Routes>
    </AppShell>
  );
}
