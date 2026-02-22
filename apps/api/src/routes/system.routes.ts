import { Router } from "express";
import { BRANDING } from "@timesheet/shared";
import { requireRole } from "../middleware/rbac.middleware.js";

export const systemRouter = Router();

systemRouter.get("/v1/system/branding", (_req, res) => {
  res.json({
    data: BRANDING
  });
});

systemRouter.get("/v1/system/audit-ping", requireRole("ADMIN"), (req, res) => {
  res.json({
    data: {
      requestId: req.requestId,
      actor: req.actor ?? null,
      deterministic: true,
      auditable: true
    }
  });
});
