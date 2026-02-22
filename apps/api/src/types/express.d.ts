import type { UserRole } from "@timesheet/shared";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      actor?: {
        employeeId: number;
        role: UserRole;
      };
    }
  }
}

export {};
