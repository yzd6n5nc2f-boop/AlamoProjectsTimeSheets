import { type PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { BRANDING } from "@timesheet/shared";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";
import { StatusChip } from "./StatusChip";
import workbookLogoLockup from "../assets/workbook-logo-lockup.png";

const links = [
  ["/", "Login"],
  ["/employee", "Employee Dashboard"],
  ["/timesheet", "Timesheet Grid"],
  ["/leave/planner", "Leave Planner"],
  ["/history", "History"],
  ["/manager/queue", "Manager Queue"],
  ["/manager/review", "Manager Review"],
  ["/payroll/dashboard", "Payroll Dashboard"],
  ["/payroll/export", "Payroll Export"],
  ["/admin/rules", "Admin Rules"],
  ["/admin/leave", "Leave Admin"]
] as const;

export function AppShell({ children }: PropsWithChildren) {
  const { role, status, periodDisplayLabel, currentDateIso } = useAppState();

  return (
    <div className="layout">
      <header className="header">
        <div className="brand-lockup">
          <img
            src={workbookLogoLockup}
            alt={`${BRANDING.product} ${BRANDING.subtitle}`}
            className="brand-logo-lockup-image"
          />
        </div>
        <div className="header-chips">
          <StatusChip label={role} tone="info" />
          <StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />
          <StatusChip label={periodDisplayLabel} tone="neutral" />
          <StatusChip label={currentDateIso} tone="neutral" />
        </div>
      </header>

      <nav className="nav">
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`.trim()}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="content">{children}</main>

      <footer className="footer">{BRANDING.footer}</footer>
    </div>
  );
}
