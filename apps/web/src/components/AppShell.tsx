import { type PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { BRANDING } from "@timesheet/shared";
import { statusTone } from "../lib/ui";
import { useAppState, type AppRole } from "../state/AppStateContext";
import { StatusChip } from "./StatusChip";
import workbookLogoLockup from "../assets/workbook-logo-lockup.png";

const ROLE_LINKS: Record<AppRole, ReadonlyArray<readonly [string, string]>> = {
  EMPLOYEE: [
    ["/", "Login"],
    ["/employee", "Employee Home"],
    ["/timesheet", "Timesheet"],
    ["/leave/planner", "Leave Planner"],
    ["/history", "Status"],
    ["/signature/setup", "Signature Setup"]
  ],
  MANAGER: [
    ["/", "Login"],
    ["/manager/queue", "Manager Queue"],
    ["/manager/review", "Manager Review"],
    ["/history", "Status"],
    ["/signature/setup", "Signature Setup"]
  ],
  PAYROLL: [
    ["/", "Login"],
    ["/payroll/dashboard", "Payroll"],
    ["/payroll/export", "Payroll Export"],
    ["/history", "Status"]
  ],
  ADMIN: [
    ["/", "Login"],
    ["/admin/rules", "Admin Rules"],
    ["/admin/leave", "Leave Admin"]
  ]
};

export function AppShell({ children }: PropsWithChildren) {
  const { role, status, periodDisplayLabel, currentDateIso } = useAppState();
  const links = ROLE_LINKS[role];

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
