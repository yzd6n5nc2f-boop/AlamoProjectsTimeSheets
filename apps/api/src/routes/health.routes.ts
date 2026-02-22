import { Router } from "express";
import { pool } from "../config/db.js";

export const healthRouter = Router();

healthRouter.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "timesheet-api" });
  } catch (error) {
    res.status(503).json({ status: "error", message: "database unavailable" });
  }
});
