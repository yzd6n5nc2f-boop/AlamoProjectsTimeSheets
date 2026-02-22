import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminRulesPage } from "./pages/AdminRulesPage";
import { EmployeeDashboardPage } from "./pages/EmployeeDashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LeaveAdminPage } from "./pages/LeaveAdminPage";
import { LoginPage } from "./pages/LoginPage";
import { ManagerQueuePage } from "./pages/ManagerQueuePage";
import { ManagerReviewPage } from "./pages/ManagerReviewPage";
import { PayrollDashboardPage } from "./pages/PayrollDashboardPage";
import { PayrollExportPage } from "./pages/PayrollExportPage";
import { TimesheetEntryPage } from "./pages/TimesheetEntryPage";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/employee" element={<EmployeeDashboardPage />} />
        <Route path="/timesheet" element={<TimesheetEntryPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/manager/queue" element={<ManagerQueuePage />} />
        <Route path="/manager/review" element={<ManagerReviewPage />} />
        <Route path="/payroll/dashboard" element={<PayrollDashboardPage />} />
        <Route path="/payroll/export" element={<PayrollExportPage />} />
        <Route path="/admin/rules" element={<AdminRulesPage />} />
        <Route path="/admin/leave" element={<LeaveAdminPage />} />
      </Routes>
    </AppShell>
  );
}
