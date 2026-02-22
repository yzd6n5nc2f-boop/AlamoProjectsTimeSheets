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
