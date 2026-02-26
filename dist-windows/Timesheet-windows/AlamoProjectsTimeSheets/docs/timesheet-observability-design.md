# Timesheet Observability Design

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer requirement on UI/PDF outputs: **Innoweb Ventures Limited**

## 1) Logging Schema (Structured API Logs)

### 1.1 Log format

- Format: JSON (one object per line)
- Timestamp: UTC ISO-8601 (`ts`)
- Severity: `TRACE | DEBUG | INFO | WARN | ERROR | FATAL`
- Correlation strategy:
  - `request_id` from `X-Request-Id` or generated UUID
  - `trace_id`/`span_id` if OpenTelemetry tracing enabled
  - `correlation_id` for background jobs and chained operations

### 1.2 Canonical fields

| Field | Type | Required | Description |
|---|---|---|---|
| `ts` | string | Yes | Event timestamp (UTC). |
| `level` | string | Yes | Log level. |
| `service` | string | Yes | e.g. `timesheet-api`. |
| `env` | string | Yes | `dev`, `staging`, `prod`. |
| `request_id` | string | Yes (request logs) | Request correlation id. |
| `trace_id` | string | No | Distributed tracing id. |
| `user_id` | number/null | No | Authenticated actor id. |
| `employee_number` | string/null | No | Business actor key. |
| `role` | string/null | No | Primary role in request context. |
| `action` | string | Yes | Semantic action (`TIMESHEET_SUBMIT`, `EXPORT_CREATE`, etc.). |
| `http_method` | string | No | `GET/POST/...` |
| `http_path` | string | No | Route template path. |
| `status_code` | number | No | HTTP status code. |
| `duration_ms` | number | No | End-to-end request latency. |
| `entity_type` | string/null | No | Domain target (`timesheet_header`, `period`, etc.). |
| `entity_id` | string/null | No | Domain target id. |
| `outcome` | string | Yes | `SUCCESS`, `FAILURE`, `REJECTED`, `RETRY`. |
| `error_code` | string/null | No | Application error code. |
| `message` | string | Yes | Human-readable summary. |
| `meta` | object | No | Safe structured context. |

### 1.3 Required event types for API logs

- `AUTH_LOGIN_ATTEMPT`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE`
- `TIMESHEET_SAVE_DRAFT`, `TIMESHEET_SUBMIT`
- `MANAGER_APPROVE`, `MANAGER_REJECT`
- `PAYROLL_VALIDATE`, `PAYROLL_MARK_VALIDATED`
- `EXPORT_CREATE`, `EXPORT_DOWNLOAD`
- `PERIOD_LOCK`, `PERIOD_UNLOCK`, `TIMESHEET_REVISION_CREATE`
- `EXCEPTION_DETECTED`, `EXCEPTION_RESOLVED`, `EXCEPTION_OVERRIDDEN`

### 1.4 Log redaction policy

Never log:

- Passwords or reset tokens
- JWT access/refresh tokens
- Full DB connection strings
- Sensitive personal fields beyond minimum identity keys

Mask strategy:

- emails partially masked in INFO logs
- request bodies allowlisted by endpoint

### 1.5 Sample log records

```json
{
  "ts": "2026-02-22T16:10:44.231Z",
  "level": "INFO",
  "service": "timesheet-api",
  "env": "prod",
  "request_id": "0f6ca35d-84b2-45f5-9ccf-9af0de9ca8e6",
  "user_id": 42,
  "employee_number": "E1001",
  "role": "EMPLOYEE",
  "action": "TIMESHEET_SUBMIT",
  "http_method": "POST",
  "http_path": "/v1/timesheets/:timesheetId/submit",
  "status_code": 200,
  "duration_ms": 184,
  "entity_type": "timesheet_header",
  "entity_id": "5001",
  "outcome": "SUCCESS",
  "message": "Timesheet submitted successfully"
}
```

```json
{
  "ts": "2026-02-22T16:14:09.047Z",
  "level": "WARN",
  "service": "timesheet-api",
  "env": "prod",
  "request_id": "8f23a9ef-08f0-4528-9d9d-5805383f56ed",
  "user_id": 77,
  "employee_number": "E2001",
  "role": "MANAGER",
  "action": "MANAGER_APPROVE",
  "http_method": "POST",
  "http_path": "/v1/manager/timesheets/:timesheetId/approve",
  "status_code": 422,
  "duration_ms": 95,
  "entity_type": "timesheet_header",
  "entity_id": "5001",
  "outcome": "REJECTED",
  "error_code": "OT_OR_PH_CONFIRMATION_REQUIRED",
  "message": "Manager approval rejected: missing OT/PH confirmation"
}
```

## 2) Audit Log Event Taxonomy

Audit events are immutable compliance records (`audit_event` + `audit_field_change`), distinct from operational app logs.

### 2.1 Categories

| Category | Event code examples |
|---|---|
| Authentication | `AUDIT_AUTH_LOGIN_SUCCESS`, `AUDIT_AUTH_PASSWORD_RESET` |
| Timesheet lifecycle | `AUDIT_TS_CREATE`, `AUDIT_TS_SUBMIT`, `AUDIT_TS_APPROVE`, `AUDIT_TS_REJECT` |
| Payroll lifecycle | `AUDIT_PAYROLL_VALIDATE`, `AUDIT_PERIOD_LOCK`, `AUDIT_PERIOD_UNLOCK` |
| Revision controls | `AUDIT_REVISION_CREATE`, `AUDIT_REVISION_REOPEN` |
| Export | `AUDIT_EXPORT_BATCH_CREATE`, `AUDIT_EXPORT_BATCH_DOWNLOAD` |
| Exception governance | `AUDIT_EXCEPTION_RESOLVE`, `AUDIT_EXCEPTION_OVERRIDE_APPROVE`, `AUDIT_EXCEPTION_OVERRIDE_REJECT` |
| Configuration | `AUDIT_RULESET_CREATE`, `AUDIT_RULESET_PUBLISH`, `AUDIT_POLICY_UPDATE` |
| Access/security | `AUDIT_RBAC_DENY`, `AUDIT_SUSPICIOUS_REQUEST` |

### 2.2 Taxonomy attributes

Required attributes:

- `event_code`
- `entity_table`, `entity_pk`
- `actor_id`, `actor_role`
- `request_id`
- `reason` (mandatory for reject, unlock, override, manual corrections)
- `changed_fields` (field-level diffs)

## 3) Metrics List

### 3.1 Application SLI/SLO metrics

| Metric | Type | Labels | Target/SLO |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status` | Baseline traffic |
| `http_request_duration_ms` | Histogram | `route`, `method`, `status_class` | p95 API latency < 500ms |
| `http_5xx_total` | Counter | `route` | < 1% of total requests (5 min window) |
| `http_4xx_total` | Counter | `route`, `error_code` | monitor abuse/validation noise |
| `auth_login_failures_total` | Counter | `reason` | anomaly alerting |
| `rbac_denied_total` | Counter | `route`, `role` | spike alerting |

### 3.2 Domain metrics

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `timesheet_submissions_total` | Counter | `period_id` | throughput |
| `timesheet_rejections_total` | Counter | `manager_id`, `reason_code` | quality |
| `timesheet_revision_created_total` | Counter | `origin` | revision pressure |
| `timesheet_blocking_exceptions_open` | Gauge | `rule_code`, `stage` | backlog control |
| `timesheet_warning_exceptions_open` | Gauge | `rule_code`, `stage` | warning trend |
| `timesheet_ot_hours_total` | Counter | `period_id` | labor trend |
| `period_unlock_events_total` | Counter | `reason_code` | control risk indicator |
| `period_locks_total` | Counter | `period_id` | closure progress |

### 3.3 Export metrics

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `export_batches_total` | Counter | `status`, `format` | export volume |
| `export_batch_duration_ms` | Histogram | `format` | performance |
| `export_batch_line_count` | Histogram | `format` | scale profile |
| `export_reproducible_reuse_total` | Counter | `period_id` | same-input reuse effectiveness |
| `export_checksum_mismatch_total` | Counter | `period_id` | integrity incident |
| `export_failures_total` | Counter | `reason` | reliability |

### 3.4 Infrastructure metrics

| Metric | Type | Labels | Target |
|---|---|---|---|
| `postgres_connections_in_use` | Gauge | `db` | < 80% pool cap |
| `postgres_query_duration_ms` | Histogram | `query_class` | p95 within threshold |
| `container_restarts_total` | Counter | `service` | no sustained restarts |
| `disk_usage_percent` | Gauge | `node`, `volume` | < 80% |
| `backup_success_total` | Counter | `env` | daily success |
| `backup_last_success_age_hours` | Gauge | `env` | < 26h |

## 4) Alert Thresholds

### 4.1 Critical alerts (page immediately)

| Alert | Condition | Window |
|---|---|---|
| API down | healthcheck failing for `api` on all replicas/instances | 2 min |
| High 5xx rate | `http_5xx_total / http_requests_total > 2%` | 5 min |
| Export integrity failure | `export_checksum_mismatch_total > 0` | immediate |
| Backup stale | `backup_last_success_age_hours > 26` | immediate |
| Audit write failure | audit write errors > 0 | immediate |

### 4.2 High alerts (urgent)

| Alert | Condition | Window |
|---|---|---|
| p95 latency degraded | `http_request_duration_ms p95 > 800ms` | 10 min |
| DB saturation | connections > 85% pool | 10 min |
| Unlock spike | `period_unlock_events_total` above baseline (e.g., >3/day) | daily |
| RBAC deny anomaly | `rbac_denied_total` > 3x 7-day average | 15 min |

### 4.3 Medium alerts (ticket)

| Alert | Condition | Window |
|---|---|---|
| Blocking exceptions backlog | open blocking exceptions > threshold (e.g., 50) | 30 min |
| Export job slow | p95 export duration > 2 min | 1 hour |
| Login failures spike | login failures > 5x baseline | 30 min |

## 5) Operational Dashboards

### 5.1 API Reliability Dashboard

- Request rate by endpoint
- p50/p95/p99 latency
- 4xx/5xx rates
- top error codes
- saturation (CPU/memory/restarts)

### 5.2 Workflow Health Dashboard

- Timesheet states count by period
- submission and rejection trend
- manager queue aging
- payroll validation throughput
- lock/unlock trend

### 5.3 Exception & Controls Dashboard

- open blocking exceptions by rule code
- override counts and approval ratio
- unlock events by reason code
- audit event volume by action

### 5.4 Export Operations Dashboard

- batches generated/day
- batch duration and line counts
- failure and retry rate
- reproducibility reuse count
- checksum integrity status

## 6) Recommended Tools

### 6.1 Logs and metrics stack

Option A (open-source self-hosted):

- Logs: Grafana Loki + Promtail
- Metrics: Prometheus + Alertmanager
- Dashboards: Grafana
- Traces: OpenTelemetry + Tempo

Option B (managed cloud):

- Logs/Metrics/APM: Datadog or New Relic
- Alerts: PagerDuty/Opsgenie integration

### 6.2 App instrumentation libraries

- Logging: `pino` (JSON structured logs)
- HTTP metrics: `prom-client`
- Tracing: `@opentelemetry/sdk-node`
- Context propagation: AsyncLocalStorage for `request_id`, principal, action

## 7) Implementation Outline

### 7.1 API logging middleware pattern (TypeScript)

```ts
import pino from "pino";
import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export function requestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = String(req.headers["x-request-id"] ?? randomUUID());
    (req as any).requestId = requestId;
    res.setHeader("x-request-id", requestId);

    res.on("finish", () => {
      const principal = (req as any).principal ?? {};
      logger.info({
        ts: new Date().toISOString(),
        request_id: requestId,
        service: "timesheet-api",
        env: process.env.APP_ENV,
        action: routeToAction(req.method, req.route?.path ?? req.path),
        http_method: req.method,
        http_path: req.route?.path ?? req.path,
        status_code: res.statusCode,
        duration_ms: Date.now() - start,
        user_id: principal.userId ?? null,
        employee_number: principal.employeeNumber ?? null,
        role: principal.roles?.[0] ?? null,
        outcome: res.statusCode < 400 ? "SUCCESS" : "FAILURE"
      }, "request.complete");
    });

    next();
  };
}

function routeToAction(method: string, path: string): string {
  if (method === "POST" && path.includes("/submit")) return "TIMESHEET_SUBMIT";
  if (method === "POST" && path.includes("/approve")) return "MANAGER_APPROVE";
  if (method === "POST" && path.includes("/export-batches")) return "EXPORT_CREATE";
  return "API_REQUEST";
}
```

### 7.2 Metrics middleware pattern (TypeScript)

```ts
import client from "prom-client";
import type { Request, Response, NextFunction } from "express";

export const httpDuration = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status_class"],
  buckets: [25, 50, 100, 250, 500, 1000, 2000, 5000]
});

export const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "HTTP requests total",
  labelNames: ["method", "route", "status"]
});

export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const route = req.route?.path ?? req.path;
      const status = String(res.statusCode);
      httpRequests.inc({ method: req.method, route, status });
      httpDuration.observe(
        { method: req.method, route, status_class: `${Math.floor(res.statusCode / 100)}xx` },
        Date.now() - start
      );
    });
    next();
  };
}
```

### 7.3 Audit taxonomy enforcement

1. Standardize event codes in `packages/shared` constants.
2. Require code selection in all mutation services.
3. Validate required audit fields (`actor`, `request_id`, `reason` when mandatory).
4. Run nightly integrity check on audit hash chain.

### 7.4 Rollout phases

1. Phase 1: structured logging + request id + basic dashboards.
2. Phase 2: domain metrics + alerts + exception/export dashboards.
3. Phase 3: tracing + SLO burn-rate alerts + automated runbook links.

## 8) Minimum SLO Set

- API availability: `99.9%` monthly
- p95 API latency: `< 500ms` for read APIs, `< 800ms` for mutation APIs
- export success rate: `>= 99.5%` monthly
- backup freshness: last successful backup `< 26h`

