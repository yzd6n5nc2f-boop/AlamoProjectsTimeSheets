import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@timesheet/shared";

const roleHeaderMap: Record<string, UserRole> = {
  employee: "EMPLOYEE",
  manager: "MANAGER",
  payroll: "PAYROLL",
  admin: "ADMIN"
};

export function fakeAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const employeeId = Number(req.header("x-employee-id") || 1);
  const roleHeader = (req.header("x-role") || "employee").toLowerCase();
  req.actor = {
    employeeId,
    role: roleHeaderMap[roleHeader] || "EMPLOYEE"
  };
  next();
}
