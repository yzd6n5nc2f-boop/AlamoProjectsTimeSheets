import { Router } from "express";
import { z } from "zod";
import { readAppState, writeAppState } from "../config/sqlite.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const sqliteStateSchema = z.object({
  months: z.record(z.string(), z.unknown()),
  plannedLeave: z.array(z.unknown()),
  signatureProfiles: z.record(z.string(), z.unknown()).default({})
});

export const sqliteRouter = Router();

sqliteRouter.get("/v1/sqlite/state", requireRole("EMPLOYEE", "MANAGER", "PAYROLL", "ADMIN"), (_req, res) => {
  const state = readAppState();
  res.json({ data: state });
});

sqliteRouter.put("/v1/sqlite/state", requireRole("EMPLOYEE", "MANAGER", "PAYROLL", "ADMIN"), (req, res) => {
  const parsed = sqliteStateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid SQLite state payload",
        details: parsed.error.issues
      }
    });
    return;
  }

  writeAppState(parsed.data);

  res.json({
    data: {
      saved: true,
      updatedAt: new Date().toISOString()
    }
  });
});
