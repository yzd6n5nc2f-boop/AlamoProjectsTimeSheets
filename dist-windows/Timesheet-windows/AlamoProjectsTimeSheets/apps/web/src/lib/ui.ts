import type { WorkflowStatus } from "./timesheetEngine";

export function statusTone(status: WorkflowStatus): "neutral" | "good" | "warn" | "bad" | "info" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "SUBMITTED":
      return "info";
    case "MANAGER_APPROVED":
      return "good";
    case "MANAGER_REJECTED":
      return "bad";
    case "PAYROLL_VALIDATED":
      return "good";
    case "LOCKED":
      return "warn";
    default:
      return "neutral";
  }
}

export function formatDate(dateValue: string): string {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }

  const date = new Date(year, month - 1 + delta, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}
