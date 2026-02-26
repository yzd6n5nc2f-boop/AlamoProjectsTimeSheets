import type { NextFunction, Request, Response } from "express";
import { writeAuditEvent } from "../services/audit.service.js";

const AUDIT_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!AUDIT_METHODS.has(req.method)) {
    next();
    return;
  }

  const startedAt = Date.now();

  res.on("finish", () => {
    void writeAuditEvent({
      entityTable: "api_request",
      entityPk: `${req.method}:${req.path}`,
      operation: req.method,
      actorEmployeeId: req.actor?.employeeId,
      actorRole: req.actor?.role,
      requestId: req.requestId,
      metadata: {
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        route: req.path
      }
    }).catch(() => {
      // Request processing should not fail because audit persistence failed.
    });
  });

  next();
}
