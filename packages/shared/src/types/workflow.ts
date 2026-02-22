export const WORKFLOW_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "MANAGER_APPROVED",
  "MANAGER_REJECTED",
  "PAYROLL_VALIDATED",
  "LOCKED"
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const USER_ROLES = ["EMPLOYEE", "MANAGER", "PAYROLL", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type ExceptionSeverity = "ERROR" | "WARNING";

export interface TimesheetTotals {
  normalMinutes: number;
  overtimeMinutes: number;
  phWorkedMinutes: number;
  leaveMinutes: number;
  paidMinutes: number;
}
