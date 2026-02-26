# Timesheet Security Hardening and RBAC Verification Pack

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer requirement for UI/PDF output: **Innoweb Ventures Limited**

## 1) Security Hardening Checklist

Use this as release-gate checklist for staging and production.

### 1.1 Authentication and password policy

| Control | Required setting | Verification |
|---|---|---|
| Password hashing | `argon2id` with strong params (`m>=64MB`, `t>=3`, `p>=1`) | Unit tests + credential table inspection |
| Password length | min 12 chars | API validation test |
| Password complexity | enforce at least 3 categories (upper/lower/number/symbol) or passphrase length >= 16 | reset-password test cases |
| Password history | reject last 5 passwords | reset flow test |
| Account lockout | after 10 failed attempts in 15 minutes; unlock by time or admin | auth brute-force test |
| Forgot password | single-use token, short TTL (15-30 min), no account enumeration | API response consistency test |
| Reset token storage | hash token server-side, never store raw token | DB/code review |

### 1.2 Rate limiting and abuse protection

| Endpoint group | Limit recommendation | Action on breach |
|---|---|---|
| `POST /v1/auth/login` | 5 requests/minute/IP + username key | `429` + temporary lock bucket |
| `POST /v1/auth/refresh` | 20 requests/minute/session | `429`, telemetry event |
| `POST /v1/auth/forgot-password` | 3 requests/hour/email + IP | `429` + silent response body |
| Workflow transitions (`submit/approve/reject/mark-validated/lock`) | 30 requests/minute/user | `429` + enforce idempotency |
| Export batch creation | 5 requests/minute/user | `429`, dedupe by input hash |

### 1.3 Session and JWT handling

| Control | Required setting | Verification |
|---|---|---|
| Access token TTL | 15 minutes | decode JWT in tests |
| Refresh token TTL | 30 days max | refresh token metadata tests |
| Refresh transport | HttpOnly + Secure + SameSite=Strict cookie | response cookie assertions |
| Refresh rotation | rotate on each refresh, invalidate old token | replay test must fail |
| Reuse detection | if old refresh reused, revoke token family | security integration test |
| JWT claims | include `sub`, `roles`, `jti`, `iat`, `exp`, `iss`, `aud` | token validation tests |
| Signing keys | asymmetric keys preferred, support `kid` rotation | key rollover test |
| Logout | revoke refresh family + clear cookie | logout/refresh negative test |

### 1.4 Transport, headers, and CORS

| Control | Required setting | Verification |
|---|---|---|
| HTTPS | TLS 1.2+ only at reverse proxy | SSL scan |
| HSTS | `max-age=31536000; includeSubDomains; preload` | response header check |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, strict referrer policy | response header check |
| CORS | explicit origin allowlist only | preflight tests |
| Cookies | `Secure`, `HttpOnly`, strict same-site as required | auth tests |

### 1.5 Input validation and injection defense

| Control | Required setting | Verification |
|---|---|---|
| API schema validation | zod/typed validation on all bodies/query/params | middleware tests |
| SQL access | parameterized queries only, no string concatenation SQL | static code scan |
| File download paths | no user-controlled filesystem paths | path traversal tests |
| Error handling | no stack traces/secrets in prod responses | error response tests |

### 1.6 Audit log protection

| Control | Required setting | Verification |
|---|---|---|
| Append-only audit tables | DB triggers prevent update/delete (`audit_event`, `audit_field_change`) | direct SQL negative test |
| Audit coverage | all mutations and state transitions logged | integration audit assertions |
| Actor traceability | store actor id/role/request id/reason | audit payload checks |
| Integrity | hash chain per event (`prev_event_hash`, `event_hash`) | integrity verification job |
| Access control | audit read endpoints admin-only | RBAC negative tests |

### 1.7 Least privilege roles

| Role | Allowed business scope | Disallowed examples |
|---|---|---|
| `EMPLOYEE` | own timesheets only | manager queue, payroll export, admin endpoints |
| `MANAGER` | assigned team review queue + decisions | config changes, payroll lock/export |
| `PAYROLL` | payroll validation, exceptions, export, lock/unlock per policy | employee row edits (except controlled revision operations) |
| `ADMIN` | admin config, audit read, break-glass operations | day-to-day approvals if policy forbids |

### 1.8 Secrets and environment hardening

| Control | Required setting | Verification |
|---|---|---|
| Secret storage | external secret manager in stage/prod | infra review |
| Secret in git | prohibited | secret scanning in CI |
| DB privilege model | app user least privilege, separate migration user | DB grants review |
| Dependency patching | weekly security updates + lockfile pinning | SCA report |

## 2) Endpoints-by-Role Access Matrix (MVP)

Legend:
- `Y` allowed
- `N` denied
- `S` allowed with scope constraint (owner/team/assignment/policy)

| Endpoint | Public | Employee | Manager | Payroll | Admin |
|---|---:|---:|---:|---:|---:|
| `POST /v1/auth/login` | Y | Y | Y | Y | Y |
| `POST /v1/auth/refresh` | Y | Y | Y | Y | Y |
| `POST /v1/auth/logout` | N | Y | Y | Y | Y |
| `POST /v1/auth/forgot-password` | Y | Y | Y | Y | Y |
| `POST /v1/auth/reset-password` | Y | Y | Y | Y | Y |
| `GET /v1/admin/employees` | N | N | N | N | Y |
| `POST /v1/admin/employees` | N | N | N | N | Y |
| `GET /v1/admin/employees/{employee_id}` | N | N | N | N | Y |
| `PATCH /v1/admin/employees/{employee_id}` | N | N | N | N | Y |
| `GET /v1/admin/periods` | N | N | N | N | Y |
| `POST /v1/admin/periods` | N | N | N | N | Y |
| `GET /v1/admin/periods/{period_id}` | N | N | N | N | Y |
| `PATCH /v1/admin/periods/{period_id}` | N | N | N | N | Y |
| `GET /v1/admin/calendar-rulesets` | N | N | N | N | Y |
| `POST /v1/admin/calendar-rulesets` | N | N | N | N | Y |
| `PUT /v1/admin/calendar-rulesets/{ruleset_id}/public-holidays` | N | N | N | N | Y |
| `PUT /v1/admin/calendar-rulesets/{ruleset_id}/special-day-rules` | N | N | N | N | Y |
| `PUT /v1/admin/calendar-rulesets/{ruleset_id}/paid-hours-policies` | N | N | N | N | Y |
| `POST /v1/admin/calendar-rulesets/{ruleset_id}/publish` | N | N | N | N | Y |
| `POST /v1/timesheets` | N | S | N | N | S |
| `GET /v1/timesheets` | N | S | S | S | Y |
| `GET /v1/timesheets/{timesheet_id}` | N | S | S | S | Y |
| `PATCH /v1/timesheets/{timesheet_id}` | N | S | N | N | S |
| `POST /v1/timesheets/{timesheet_id}/submit` | N | S | N | N | N |
| `PUT /v1/timesheets/{timesheet_id}/day-entries` | N | S | N | N | S |
| `DELETE /v1/timesheets/{timesheet_id}/day-entries/{entry_id}` | N | S | N | N | S |
| `GET /v1/manager/timesheets/queue` | N | N | Y | N | N |
| `POST /v1/manager/timesheets/{timesheet_id}/approve` | N | N | Y | N | N |
| `POST /v1/manager/timesheets/{timesheet_id}/reject` | N | N | Y | N | N |
| `GET /v1/payroll/periods/{period_id}/exceptions` | N | N | N | Y | Y |
| `POST /v1/payroll/timesheets/{timesheet_id}/validate` | N | N | N | Y | N |
| `POST /v1/payroll/timesheets/{timesheet_id}/mark-validated` | N | N | N | Y | N |
| `POST /v1/payroll/export-batches` | N | N | N | Y | Y |
| `POST /v1/payroll/periods/{period_id}/lock` | N | N | N | Y | S |
| `GET /v1/payroll/export-batches/{batch_id}` | N | N | N | Y | Y |
| `GET /v1/payroll/export-batches/{batch_id}/download` | N | N | N | Y | Y |
| `GET /v1/admin/audit/events` | N | N | N | N | Y |
| `GET /v1/admin/audit/events/{audit_event_id}` | N | N | N | N | Y |
| `GET /v1/admin/audit/entities/{entity_table}/{entity_pk}` | N | N | N | N | Y |

## 3) RBAC Verification Test Cases

### 3.1 Positive authorization tests

| ID | Actor | Endpoint | Expected |
|---|---|---|---|
| RBAC-P-01 | Employee owner | `GET /v1/timesheets/{own_id}` | `200` |
| RBAC-P-02 | Employee owner | `PUT /v1/timesheets/{own_id}/day-entries` (editable status) | `200` |
| RBAC-P-03 | Manager | `GET /v1/manager/timesheets/queue` | `200` |
| RBAC-P-04 | Manager assigned | `POST /v1/manager/timesheets/{team_ts}/approve` | `200` |
| RBAC-P-05 | Payroll | `POST /v1/payroll/timesheets/{approved_ts}/validate` | `200` |
| RBAC-P-06 | Payroll | `POST /v1/payroll/export-batches` | `201/200` |
| RBAC-P-07 | Admin | `PUT /v1/admin/calendar-rulesets/{id}/paid-hours-policies` | `200` |
| RBAC-P-08 | Admin | `GET /v1/admin/audit/events` | `200` |

### 3.2 Negative authorization tests

| ID | Actor | Endpoint | Expected |
|---|---|---|---|
| RBAC-N-01 | Unauthenticated | `GET /v1/timesheets` | `401` |
| RBAC-N-02 | Employee | `GET /v1/manager/timesheets/queue` | `403` |
| RBAC-N-03 | Employee | `GET /v1/admin/employees` | `403` |
| RBAC-N-04 | Manager | `POST /v1/payroll/export-batches` | `403` |
| RBAC-N-05 | Payroll | `PUT /v1/timesheets/{id}/day-entries` | `403` |
| RBAC-N-06 | Manager | `GET /v1/admin/audit/events` | `403` |
| RBAC-N-07 | Employee A | `GET /v1/timesheets/{employee_b_ts}` | `403` |
| RBAC-N-08 | Manager unassigned | `POST /v1/manager/timesheets/{unassigned_ts}/approve` | `403` |
| RBAC-N-09 | Admin without policy | `POST /v1/payroll/periods/{id}/lock` | `403` |
| RBAC-N-10 | Public | `POST /v1/auth/logout` | `401` |

### 3.3 Status and scope guard tests

| ID | Actor | Scenario | Expected |
|---|---|---|---|
| RBAC-S-01 | Employee owner | Edit submitted timesheet | `409 STATUS_NOT_EDITABLE` |
| RBAC-S-02 | Employee owner | Submit someone else’s timesheet | `403` |
| RBAC-S-03 | Manager | Approve already approved timesheet | `409 INVALID_WORKFLOW_TRANSITION` |
| RBAC-S-04 | Payroll | Validate not-manager-approved timesheet | `409 STATUS_NOT_MANAGER_APPROVED` |
| RBAC-S-05 | Payroll | Lock period with blockers | `409 PERIOD_NOT_LOCKABLE` |

## 4) OWASP-Style Risks Relevant to Timesheet

| OWASP category | App-specific risk | Mitigation controls | Verification |
|---|---|---|---|
| Broken Access Control | Employee accesses other employee timesheet or admin endpoints | route-level RBAC + resource scope checks | IDOR/RBAC integration tests |
| Cryptographic Failures | weak password hashing, insecure JWT secrets | Argon2id, key rotation, secure secret storage | security config audit |
| Injection | SQL injection through filters/search | strict validation + parameterized queries | injection tests and SAST |
| Insecure Design | invalid workflow transitions, editable locked data | lifecycle guard service + DB lock triggers | workflow negative tests |
| Security Misconfiguration | permissive CORS, missing TLS headers | strict CORS + hardened proxy headers | response/header scans |
| Vulnerable Components | outdated Node/libs | dependency scanning + patch policy | CI SCA gate |
| Identification and Authentication Failures | token replay/refresh abuse | refresh rotation + reuse detection + rate limits | auth abuse tests |
| Software and Data Integrity Failures | tampering with audit trail/export files | append-only audit triggers + checksum hashes | DB and checksum verification |
| Security Logging and Monitoring Failures | missing traceability for approvals/overrides | request-id + structured audit events | log completeness checks |
| SSRF / external call abuse | unsafe webhook or callback integrations | deny outbound by default, allowlist destinations | network policy tests |

## 5) API Middleware Patterns (TypeScript)

### 5.1 Auth + RBAC middleware

```ts
import type { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

type Role = "EMPLOYEE" | "MANAGER" | "PAYROLL" | "ADMIN";

interface AuthPrincipal {
  userId: number;
  employeeNumber: string;
  roles: Role[];
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      principal?: AuthPrincipal;
      requestId?: string;
    }
  }
}

export function authenticateAccessToken(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing token" } });
    }

    const token = auth.slice("Bearer ".length);
    try {
      const payload = jwt.verify(token, secret, {
        audience: "timesheet-api",
        issuer: "timesheet-auth"
      }) as JwtPayload;

      req.principal = {
        userId: Number(payload.sub),
        employeeNumber: String(payload.employee_number),
        roles: (payload.roles as Role[]) ?? [],
        jti: String(payload.jti)
      };

      return next();
    } catch {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Invalid token" } });
    }
  };
}

export function requireRoles(allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const principal = req.principal;
    if (!principal) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing principal" } });
    }
    const ok = principal.roles.some((r) => allowed.includes(r));
    if (!ok) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role" } });
    }
    return next();
  };
}
```

### 5.2 Resource-scope guard (owner/manager/admin)

```ts
// service contract injected for DB scope checks
interface AccessScopeService {
  isTimesheetOwner(timesheetId: number, userId: number): Promise<boolean>;
  isManagerOfTimesheet(timesheetId: number, userId: number): Promise<boolean>;
}

export function requireTimesheetScope(scope: AccessScopeService, mode: "owner_or_admin" | "owner_manager_payroll_admin") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const principal = req.principal!;
    const timesheetId = Number(req.params.timesheet_id ?? req.params.timesheetId);

    const isAdmin = principal.roles.includes("ADMIN");
    const isPayroll = principal.roles.includes("PAYROLL");
    const owner = await scope.isTimesheetOwner(timesheetId, principal.userId);
    const manager = await scope.isManagerOfTimesheet(timesheetId, principal.userId);

    let allowed = false;
    if (mode === "owner_or_admin") {
      allowed = owner || isAdmin;
    }
    if (mode === "owner_manager_payroll_admin") {
      allowed = owner || manager || isPayroll || isAdmin;
    }

    if (!allowed) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Out of scope" } });
    }
    return next();
  };
}
```

### 5.3 Rate limiting pattern (auth + workflow sensitive endpoints)

```ts
import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? "anon").toLowerCase()}`
});

export const workflowLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.principal?.userId ?? "anon"}`
});
```

### 5.4 Audit context middleware pattern

```ts
import { randomUUID } from "crypto";

export function requestContext() {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.requestId = String(req.headers["x-request-id"] ?? randomUUID());
    next();
  };
}

interface AuditWriter {
  write(event: {
    requestId: string;
    actorUserId?: number;
    actorRoles?: string[];
    entityTable: string;
    entityPk: string;
    operation: string;
    reason?: string;
    fieldDiffs: Array<{ fieldPath: string; oldValue: unknown; newValue: unknown }>;
  }): Promise<void>;
}

export function withAudit(writer: AuditWriter, meta: { entityTable: string; operation: string }) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // attach helper for controllers/services to persist immutable audit rows
    (req as any).audit = async (entityPk: string, fieldDiffs: Array<{ fieldPath: string; oldValue: unknown; newValue: unknown }>, reason?: string) => {
      await writer.write({
        requestId: req.requestId!,
        actorUserId: req.principal?.userId,
        actorRoles: req.principal?.roles,
        entityTable: meta.entityTable,
        entityPk,
        operation: meta.operation,
        reason,
        fieldDiffs
      });
    };
    next();
  };
}
```

### 5.5 Route composition example

```ts
router.post(
  "/v1/manager/timesheets/:timesheetId/approve",
  authenticateAccessToken(process.env.JWT_ACCESS_SECRET!),
  requireRoles(["MANAGER"]),
  workflowLimiter,
  requireTimesheetScope(scopeService, "owner_manager_payroll_admin"),
  approveController
);
```

## 6) Release Gate for Security/RBAC Pack

| Gate | Pass criteria |
|---|---|
| Hardening checklist | All controls marked implemented or risk-accepted with owner/date |
| RBAC matrix tests | 100% pass for required positive/negative cases |
| OWASP risk checks | Critical/high findings resolved before production deploy |
| Audit protection | append-only trigger tests pass |
| Footer compliance | UI/PDF footer string present in acceptance tests |

