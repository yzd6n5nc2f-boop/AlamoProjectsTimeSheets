import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminRulesPage } from "./pages/AdminRulesPage";
import { EmployeeDashboardPage } from "./pages/EmployeeDashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LeaveAdminPage } from "./pages/LeaveAdminPage";
import { LeavePlannerPage } from "./pages/LeavePlannerPage";
import { LoginPage } from "./pages/LoginPage";
import { ManagerQueuePage } from "./pages/ManagerQueuePage";
import { ManagerReviewPage } from "./pages/ManagerReviewPage";
import { PayrollDashboardPage } from "./pages/PayrollDashboardPage";
import { PayrollExportPage } from "./pages/PayrollExportPage";
import { SignatureSetupPage } from "./pages/SignatureSetupPage";
import { TimesheetEntryPage } from "./pages/TimesheetEntryPage";
import { useAppState, type AppRole } from "./state/AppStateContext";

const ROLE_HOME: Record<AppRole, string> = {
  EMPLOYEE: "/employee",
  MANAGER: "/manager/queue",
  PAYROLL: "/payroll/dashboard",
  ADMIN: "/admin/rules"
};

function RoleRoute({ allowed, element }: { allowed: AppRole[]; element: JSX.Element }) {
  const { role } = useAppState();

  if (!allowed.includes(role)) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }

  return element;
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/employee" element={<RoleRoute allowed={["EMPLOYEE"]} element={<EmployeeDashboardPage />} />} />
        <Route path="/timesheet" element={<RoleRoute allowed={["EMPLOYEE"]} element={<TimesheetEntryPage />} />} />
        <Route path="/leave/planner" element={<RoleRoute allowed={["EMPLOYEE"]} element={<LeavePlannerPage />} />} />
        <Route path="/history" element={<RoleRoute allowed={["EMPLOYEE", "MANAGER", "PAYROLL"]} element={<HistoryPage />} />} />
        <Route path="/manager/queue" element={<RoleRoute allowed={["MANAGER"]} element={<ManagerQueuePage />} />} />
        <Route path="/manager/review" element={<RoleRoute allowed={["MANAGER"]} element={<ManagerReviewPage />} />} />
        <Route path="/payroll/dashboard" element={<RoleRoute allowed={["PAYROLL"]} element={<PayrollDashboardPage />} />} />
        <Route path="/payroll/export" element={<RoleRoute allowed={["PAYROLL"]} element={<PayrollExportPage />} />} />
        <Route path="/admin/rules" element={<RoleRoute allowed={["ADMIN"]} element={<AdminRulesPage />} />} />
        <Route path="/admin/leave" element={<RoleRoute allowed={["ADMIN"]} element={<LeaveAdminPage />} />} />
        <Route path="/signature/setup" element={<RoleRoute allowed={["EMPLOYEE", "MANAGER"]} element={<SignatureSetupPage />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
