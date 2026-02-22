export declare const WORKFLOW_STATUSES: readonly ["DRAFT", "SUBMITTED", "MANAGER_APPROVED", "MANAGER_REJECTED", "PAYROLL_VALIDATED", "LOCKED"];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export declare const USER_ROLES: readonly ["EMPLOYEE", "MANAGER", "PAYROLL", "ADMIN"];
export type UserRole = (typeof USER_ROLES)[number];
export type ExceptionSeverity = "ERROR" | "WARNING";
export interface TimesheetTotals {
    normalMinutes: number;
    overtimeMinutes: number;
    phWorkedMinutes: number;
    leaveMinutes: number;
    paidMinutes: number;
}
