import type { UserRole } from "@timesheet/shared";
import type { NextFunction, Request, Response } from "express";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.actor?.role;

    if (!role || !roles.includes(role)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission for this action."
        }
      });
      return;
    }

    next();
  };
}
