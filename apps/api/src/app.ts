import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { env } from "./config/env.js";
import { auditMiddleware } from "./middleware/audit.middleware.js";
import { fakeAuthMiddleware } from "./middleware/auth.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { systemRouter } from "./routes/system.routes.js";

const logger = pino({
  level: env.APP_ENV === "production" ? "info" : "debug"
});

export function createApp() {
  const app = express();

  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());

  app.use(helmet());
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestIdMiddleware);
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
          actorRole: req.actor?.role ?? null,
          actorEmployeeId: req.actor?.employeeId ?? null
        },
        "request completed"
      );
    });
    next();
  });

  app.use(fakeAuthMiddleware);
  app.use(auditMiddleware);

  app.use(healthRouter);
  app.use(systemRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found."
      }
    });
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ error }, "Unhandled error");
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error."
      }
    });
  });

  return app;
}
