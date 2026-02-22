# Timesheet Frontend Implementation Plan (React + TypeScript)

Branding:
- Product: `Timesheet`
- Subtitle: `for Alamo Projects`
- Global footer text on all pages: `Innoweb Ventures Limited`

## 1) Folder Structure

```txt
frontend/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx
    app/
      App.tsx
      AppShell.tsx
      router.tsx
      RouteGuard.tsx
      providers/
        QueryProvider.tsx
        AuthProvider.tsx
    config/
      branding.ts
      env.ts
    styles/
      tokens.css
      globals.css
    lib/
      api/
        httpClient.ts
        authClient.ts
        timesheetClient.ts
        managerClient.ts
        payrollClient.ts
        adminClient.ts
      validation/
        schemas.ts
        errorMap.ts
      utils/
        dates.ts
        totals.ts
        format.ts
    store/
      auth.store.ts
      ui.store.ts
      filters.store.ts
    components/
      ui/
        Button.tsx
        Input.tsx
        Select.tsx
        TextArea.tsx
        Modal.tsx
        Table.tsx
        Chip.tsx
        Pagination.tsx
        Spinner.tsx
      layout/
        Header.tsx
        Sidebar.tsx
        Footer.tsx
      feedback/
        ErrorBanner.tsx
        EmptyState.tsx
        ConfirmDialog.tsx
    features/
      auth/
        pages/LoginPage.tsx
      employee/
        pages/EmployeeDashboardPage.tsx
        pages/TimesheetEntryPage.tsx
        pages/TimesheetHistoryPage.tsx
        components/TimesheetGrid.tsx
        components/TimesheetTotalsPanel.tsx
      manager/
        pages/ManagerQueuePage.tsx
        pages/ManagerReviewDetailPage.tsx
        components/ManagerQueueTable.tsx
        components/ApprovalPanel.tsx
      payroll/
        pages/PayrollDashboardPage.tsx
        pages/PayrollExportPage.tsx
        components/ExceptionsTable.tsx
        components/ExportBatchTable.tsx
      admin/
        pages/AdminCalendarRulesPage.tsx
        pages/LeaveAdminPage.tsx
        components/RuleSetEditor.tsx
        components/LeaveCodeTable.tsx
    routes/
      AuthRoutes.tsx
      EmployeeRoutes.tsx
      ManagerRoutes.tsx
      PayrollRoutes.tsx
      AdminRoutes.tsx
```

## 2) Core Components List

### App and layout

- `AppShell`: common page frame with header/sidebar/content/footer.
- `RouteGuard`: role-based route protection.
- `Header`: shows `Timesheet` and subtitle `for Alamo Projects`.
- `Footer`: always renders `Innoweb Ventures Limited`.

### UI primitives

- `Table`: wrapped table with sorting/pagination/sticky header support.
- `Chip`: workflow status chips (`Draft`, `Submitted`, `Manager Approved`, `Manager Rejected`, `Payroll Validated`, `Locked`).
- `Modal` and `ConfirmDialog`: submit/approve/reject/lock confirmation flows.
- `Input`, `Select`, `TextArea`, `Button`, `Pagination`, `Spinner`.
- `ErrorBanner`, `EmptyState` for feedback.

### Domain components

- `TimesheetGrid`: paper-like daily entry grid with deterministic validation and totals.
- `TimesheetTotalsPanel`: weekly/period aggregate display.
- `ManagerQueueTable`: dense queue optimized for speed.
- `ApprovalPanel`: manager approve/reject actions with notes.
- `ExceptionsTable`: payroll exceptions-first list.
- `ExportBatchTable`: batch metadata and download actions.
- `RuleSetEditor`: admin calendar and paid-hours policy editor.
- `LeaveCodeTable`: leave code and leave config management.

### Component library approach

- Keep a thin internal design system in `components/ui`.
- Use composition over large third-party UI kits to retain deterministic behavior and consistent status/validation semantics.
- Wrap table engine (`@tanstack/react-table`) inside `Table.tsx` to standardize sorting/filtering interactions.
- Centralize token usage in `styles/tokens.css` + `config/branding.ts`.

## 3) Page-by-Page Component Breakdown

### Login (`/login`)

- Components: `LoginForm`, `ErrorBanner`.
- Purpose: credential login and session bootstrap.

### Employee Dashboard (`/employee/dashboard`)

- Components: period list `Table`, status `Chip`, summary cards.
- Purpose: open current period and quick status visibility.

### Timesheet Entry Grid (`/employee/timesheets/:timesheetId`)

- Components: `TimesheetGrid`, `TimesheetTotalsPanel`, `ErrorBanner`, submit `ConfirmDialog`.
- Purpose: row entry, validation highlighting, deterministic calculations, submit.

### History (`/employee/history`)

- Components: `Table`, filters, status chips, detail drawer link.
- Purpose: previous periods and read-only audit-aware view.

### Manager Queue (`/manager/queue`)

- Components: `ManagerQueueTable`, filter toolbar, quick action controls.
- Purpose: high-throughput approve/reject processing.

### Manager Review Detail (`/manager/timesheets/:timesheetId`)

- Components: read-only `TimesheetGrid`, `ApprovalPanel`, decision dialogs.
- Purpose: confirm OT/PH and final decision with notes.

### Payroll Dashboard (`/payroll/dashboard`)

- Components: KPI cards, `ExceptionsTable`, readiness checklist.
- Purpose: exceptions-first validation workflow.

### Payroll Export (`/payroll/export`)

- Components: export creation form, `ExportBatchTable`, download actions.
- Purpose: batch creation and CSV/XLSX retrieval.

### Admin Calendar/Rules (`/admin/calendar-rules`)

- Components: `RuleSetEditor`, holiday tables, special day policy forms, publish flow.
- Purpose: configure public holidays, early knock-off, Friday short-day, paid-hours policies.

### Leave Admin (`/admin/leave`)

- Components: `LeaveCodeTable`, leave settings form, balance/ledger views.
- Purpose: leave code configuration and balances administration.

### Routing by role

- `EMPLOYEE`: dashboard, timesheet entry, history.
- `MANAGER`: queue, review detail.
- `PAYROLL`: dashboard, export, lock actions.
- `ADMIN`: employees/periods/rules/leave/audit views.

## State Management Choice and Rationale

- Server state: `@tanstack/react-query` for caching, retries, invalidation, pagination.
- Local UI state: `zustand` for auth snapshot, filter state, modal toggles.
- Form state/validation: `react-hook-form` + `zod`.

Rationale:
- Separates server truth from local interaction state.
- Keeps mutation and refetch patterns predictable.
- Avoids unnecessary global complexity while preserving type safety.

## API Client Layer

- `httpClient.ts`: base transport wrapper, bearer token, refresh handling, common errors.
- Domain clients by module (`timesheetClient`, `managerClient`, `payrollClient`, `adminClient`).
- Include support for `Idempotency-Key` and `If-Match`/row-version concurrency tokens.
- Normalize server validation errors to field-level errors for forms/grids.

## Form Validation Approach

- Shared zod schemas in `lib/validation/schemas.ts`.
- Client-side deterministic checks:
  - absence selected => start/finish disabled and blank
  - finish must be after start
  - no invalid combos
  - no negative/impossible totals
- Server remains authoritative; UI maps backend field errors for highlight and summary.

## Branding Tokens

File `src/config/branding.ts`:

```ts
export const BRAND = {
  name: "Timesheet",
  subtitle: "for Alamo Projects",
  footer: "Innoweb Ventures Limited"
} as const;
```

File `src/styles/tokens.css`:

```css
:root {
  --brand-name: "Timesheet";
  --brand-accent: #0a5c5f;
  --status-draft: #6b7280;
  --status-submitted: #2563eb;
  --status-approved: #4338ca;
  --status-rejected: #b91c1c;
  --status-payroll-validated: #15803d;
  --status-locked: #1f2937;
}
```

## 4) Sample Code: TimesheetGrid with Validation Highlighting and Totals Footer

```tsx
import React, { useMemo } from "react";

type DayType = "WORKDAY" | "FRIDAY_SHORT" | "EARLY_KNOCKOFF" | "PUBLIC_HOLIDAY";
type AbsenceCode = "PH" | "AL" | "SL" | "LWP" | null;
type FieldKey = "startTime" | "finishTime" | "breakMinutes" | "absenceCode" | "row";

export interface TimesheetRow {
  id: string;
  workDate: string;
  dayType: DayType;
  startTime: string;
  finishTime: string;
  breakMinutes: number;
  absenceCode: AbsenceCode;
}

export interface RulesConfig {
  fullDayMinutes: number;
  fridayShortDayMinutes: number;
  earlyKnockoffPaidFullDay: boolean;
  earlyKnockoffMinutes: number;
  leavePaidMinutesPerDay: number;
  phNotWorkedPaidMinutes: number;
  maxDailyMinutes: number;
}

type Calc = { normal: number; ot: number; phWorked: number; leave: number; total: number };
type RowError = { field: FieldKey; message: string };

const DEFAULT_CFG: RulesConfig = {
  fullDayMinutes: 480,
  fridayShortDayMinutes: 360,
  earlyKnockoffPaidFullDay: true,
  earlyKnockoffMinutes: 300,
  leavePaidMinutesPerDay: 480,
  phNotWorkedPaidMinutes: 480,
  maxDailyMinutes: 960
};

const toMinutes = (hhmm: string): number | null => {
  if (!hhmm) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const targetMinutes = (row: TimesheetRow, cfg: RulesConfig): number => {
  if (row.dayType === "FRIDAY_SHORT") return cfg.fridayShortDayMinutes;
  if (row.dayType === "EARLY_KNOCKOFF") {
    return cfg.earlyKnockoffPaidFullDay ? cfg.fullDayMinutes : cfg.earlyKnockoffMinutes;
  }
  return cfg.fullDayMinutes;
};

const calcRow = (row: TimesheetRow, cfg: RulesConfig): Calc => {
  if (row.absenceCode) {
    const leave = row.absenceCode === "PH" ? cfg.phNotWorkedPaidMinutes : cfg.leavePaidMinutesPerDay;
    return { normal: 0, ot: 0, phWorked: 0, leave, total: leave };
  }
  const start = toMinutes(row.startTime);
  const finish = toMinutes(row.finishTime);
  if (start == null || finish == null) return { normal: 0, ot: 0, phWorked: 0, leave: 0, total: 0 };
  const worked = finish - start - row.breakMinutes;
  if (worked <= 0) return { normal: 0, ot: 0, phWorked: 0, leave: 0, total: 0 };
  if (row.dayType === "PUBLIC_HOLIDAY") return { normal: 0, ot: 0, phWorked: worked, leave: 0, total: worked };
  const t = targetMinutes(row, cfg);
  const normal = Math.min(worked, t);
  const ot = Math.max(0, worked - t);
  return { normal, ot, phWorked: 0, leave: 0, total: normal + ot };
};

const validateRow = (row: TimesheetRow, cfg: RulesConfig): RowError[] => {
  const out: RowError[] = [];
  const hasTime = Boolean(row.startTime || row.finishTime);
  if (row.absenceCode && hasTime) {
    out.push({ field: "startTime", message: "Start/Finish must be blank when absence code is selected." });
    out.push({ field: "finishTime", message: "Start/Finish must be blank when absence code is selected." });
  }
  if (!row.absenceCode) {
    if ((row.startTime && !row.finishTime) || (!row.startTime && row.finishTime)) {
      out.push({ field: "startTime", message: "Start and Finish are both required." });
      out.push({ field: "finishTime", message: "Start and Finish are both required." });
    }
    const s = toMinutes(row.startTime);
    const f = toMinutes(row.finishTime);
    if (s != null && f != null) {
      if (f <= s) out.push({ field: "finishTime", message: "Finish must be after Start." });
      if (f - s - row.breakMinutes > cfg.maxDailyMinutes) {
        out.push({ field: "row", message: "Impossible hours for one day." });
      }
    }
  }
  if (row.dayType === "PUBLIC_HOLIDAY" && !hasTime && row.absenceCode !== "PH") {
    out.push({ field: "absenceCode", message: "Public holiday not worked must be coded as PH." });
  }
  return out;
};

type Props = {
  rows: TimesheetRow[];
  onChange: (rows: TimesheetRow[]) => void;
  cfg?: Partial<RulesConfig>;
};

export function TimesheetGrid({ rows, onChange, cfg }: Props) {
  const rules = { ...DEFAULT_CFG, ...cfg };

  const perRowCalc = useMemo(() => new Map(rows.map((r) => [r.id, calcRow(r, rules)])), [rows, rules]);
  const perRowErr = useMemo(() => new Map(rows.map((r) => [r.id, validateRow(r, rules)])), [rows, rules]);

  const periodTotals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          const c = perRowCalc.get(r.id)!;
          return {
            normal: acc.normal + c.normal,
            ot: acc.ot + c.ot,
            phWorked: acc.phWorked + c.phWorked,
            leave: acc.leave + c.leave,
            total: acc.total + c.total
          };
        },
        { normal: 0, ot: 0, phWorked: 0, leave: 0, total: 0 }
      ),
    [rows, perRowCalc]
  );

  const patchRow = (id: string, patch: Partial<TimesheetRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const hasErr = (rowId: string, field: FieldKey) =>
    (perRowErr.get(rowId) ?? []).some((e) => e.field === field);

  return (
    <table className="ts-grid">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Start</th>
          <th>Finish</th>
          <th>Break</th>
          <th>Absence</th>
          <th>Normal</th>
          <th>OT</th>
          <th>PH Worked</th>
          <th>Leave</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const c = perRowCalc.get(row.id)!;
          const disableTime = Boolean(row.absenceCode);
          return (
            <tr key={row.id} className={(perRowErr.get(row.id) ?? []).length ? "row-error" : ""}>
              <td>{row.workDate}</td>
              <td>{row.dayType}</td>
              <td>
                <input
                  type="time"
                  value={row.startTime}
                  disabled={disableTime}
                  className={hasErr(row.id, "startTime") ? "cell-invalid" : ""}
                  onChange={(e) => patchRow(row.id, { startTime: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="time"
                  value={row.finishTime}
                  disabled={disableTime}
                  className={hasErr(row.id, "finishTime") ? "cell-invalid" : ""}
                  onChange={(e) => patchRow(row.id, { finishTime: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={row.breakMinutes}
                  className={hasErr(row.id, "breakMinutes") ? "cell-invalid" : ""}
                  disabled={disableTime}
                  onChange={(e) => patchRow(row.id, { breakMinutes: Number(e.target.value) || 0 })}
                />
              </td>
              <td>
                <select
                  value={row.absenceCode ?? ""}
                  className={hasErr(row.id, "absenceCode") ? "cell-invalid" : ""}
                  onChange={(e) => {
                    const code = (e.target.value || null) as AbsenceCode;
                    if (code) patchRow(row.id, { absenceCode: code, startTime: "", finishTime: "", breakMinutes: 0 });
                    else patchRow(row.id, { absenceCode: null });
                  }}
                >
                  <option value="">--</option>
                  <option value="PH">PH</option>
                  <option value="AL">AL</option>
                  <option value="SL">SL</option>
                  <option value="LWP">LWP</option>
                </select>
              </td>
              <td>{(c.normal / 60).toFixed(2)}</td>
              <td>{(c.ot / 60).toFixed(2)}</td>
              <td>{(c.phWorked / 60).toFixed(2)}</td>
              <td>{(c.leave / 60).toFixed(2)}</td>
              <td>{(c.total / 60).toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="period-total">
          <td colSpan={6}>Period Total</td>
          <td>{(periodTotals.normal / 60).toFixed(2)}</td>
          <td>{(periodTotals.ot / 60).toFixed(2)}</td>
          <td>{(periodTotals.phWorked / 60).toFixed(2)}</td>
          <td>{(periodTotals.leave / 60).toFixed(2)}</td>
          <td>{(periodTotals.total / 60).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
```

Minimal styles:

```css
.cell-invalid { border: 1px solid #b91c1c; background: #fff1f2; }
.row-error td { background: #fffafa; }
.period-total { font-weight: 700; background: #e6f4f1; }
```

