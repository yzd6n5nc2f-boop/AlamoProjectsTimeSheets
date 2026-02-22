import { type PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { BRANDING } from "@timesheet/shared";

const links = [
  ["/", "Login"],
  ["/employee", "Employee Dashboard"],
  ["/timesheet", "Timesheet Grid"],
  ["/history", "History"],
  ["/manager/queue", "Manager Queue"],
  ["/manager/review", "Manager Review"],
  ["/payroll/dashboard", "Payroll Dashboard"],
  ["/payroll/export", "Payroll Export"],
  ["/admin/rules", "Admin Rules"],
  ["/admin/leave", "Leave Admin"]
] as const;

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="layout">
      <header className="header">
        <div>
          <h1>{BRANDING.product}</h1>
          <p>{BRANDING.subtitle}</p>
        </div>
      </header>

      <nav className="nav">
        {links.map(([to, label]) => (
          <Link key={to} to={to} className="nav-link">
            {label}
          </Link>
        ))}
      </nav>

      <main className="content">{children}</main>

      <footer className="footer">{BRANDING.footer}</footer>
    </div>
  );
}
