import { type PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { BRANDING } from "@timesheet/shared";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";
import { StatusChip } from "./StatusChip";

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
          <span className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="workbookLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2f568a" />
                  <stop offset="100%" stopColor="#5ca7ab" />
                </linearGradient>
              </defs>
              <rect x="3" y="4" width="30" height="28" rx="7" fill="url(#workbookLogoGradient)" />
              <rect x="9" y="10" width="18" height="2.8" rx="1.4" fill="#eaf1fa" />
              <rect x="9" y="16.2" width="18" height="2.8" rx="1.4" fill="#eaf1fa" />
              <rect x="9" y="22.4" width="10.5" height="2.8" rx="1.4" fill="#eaf1fa" />
              <circle cx="25.4" cy="23.8" r="3.5" fill="#d7ece8" />
              <path d="M23.7 23.8l1.2 1.2 2.2-2.5" stroke="#2a6a5f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </span>
          <div>
            <h1>{BRANDING.product}</h1>
            <p>{BRANDING.subtitle}</p>
          </div>
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
