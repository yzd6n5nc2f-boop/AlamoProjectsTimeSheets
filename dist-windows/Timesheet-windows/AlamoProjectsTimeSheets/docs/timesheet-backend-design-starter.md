# Timesheet Backend Design and Starter Structure (Node.js + TypeScript)

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
UI/document footer standard: **Innoweb Ventures Limited**

## 1) Folder Structure

```txt
backend/
  package.json
  tsconfig.json
  .env.example
  src/
    server.ts
    app.ts
    config/
      env.ts
      logger.ts
      constants.ts
    db/
      pool.ts
      transaction.ts
      query.ts
      migrations/
        001_init_timesheet_schema.sql
        002_guards_and_triggers.sql
        003_seed_baseline_rules.sql
        004_reporting_views.sql
        005_idempotency_keys.sql
    shared/
      errors/
        AppError.ts
        errorCodes.ts
      http/
        response.ts
        pagination.ts
      security/
        password.ts
        jwt.ts
      validation/
        schemas.ts
        parse.ts
      types/
        auth.ts
        workflow.ts
    middleware/
      authJwt.middleware.ts
      rbac.middleware.ts
      idempotency.middleware.ts
      requestContext.middleware.ts
      errorHandler.middleware.ts
      auditLog.middleware.ts
    repositories/
      employee.repository.ts
      period.repository.ts
      calendarRules.repository.ts
      timesheet.repository.ts
      dayEntry.repository.ts
      approval.repository.ts
      leave.repository.ts
      payrollExport.repository.ts
      audit.repository.ts
      idempotency.repository.ts
    services/
      auth.service.ts
      employee.service.ts
      period.service.ts
      calendarRules.service.ts
      rulesEngine.service.ts
      timesheetLifecycle.service.ts
      timesheetCalculation.service.ts
      timesheet.service.ts
      managerApproval.service.ts
      payrollValidation.service.ts
      payrollExport.service.ts
      audit.service.ts
    controllers/
      auth.controller.ts
      employeeAdmin.controller.ts
      periodAdmin.controller.ts
      calendarRulesAdmin.controller.ts
      timesheet.controller.ts
      dayEntry.controller.ts
      managerApproval.controller.ts
      payroll.controller.ts
      export.controller.ts
      auditAdmin.controller.ts
    routes/
      auth.routes.ts
      admin.routes.ts
      timesheet.routes.ts
      manager.routes.ts
      payroll.routes.ts
      audit.routes.ts
      index.ts
    jobs/
      exportBatch.job.ts
      tokenCleanup.job.ts
    tests/
      integration/
        timesheetLifecycle.test.ts
        payrollExport.test.ts
      unit/
        rulesEngine.test.ts
        timesheetCalculation.test.ts
```

## 2) Key Modules and Responsibilities

### API Layer

- `controllers/*`: parse request, call service, map service errors to HTTP errors, return envelopes.
- `routes/*`: attach middleware by endpoint group (`auth`, `admin`, `timesheet`, `manager`, `payroll`, `audit`).
- `middleware/*`: auth, RBAC, idempotency, request context, audit capture, global error handling.

### Domain Services

- `auth.service.ts`:
  - Login, refresh, logout, forgot/reset password.
  - Access token (short TTL), refresh token rotation and revocation.
- `timesheetLifecycle.service.ts`:
  - Enforce allowed transitions:
    - `DRAFT -> SUBMITTED`
    - `SUBMITTED -> MANAGER_APPROVED | MANAGER_REJECTED`
    - `MANAGER_APPROVED -> PAYROLL_VALIDATED`
    - `PAYROLL_VALIDATED -> LOCKED`
    - `MANAGER_REJECTED -> SUBMITTED` via resubmit
  - Reject all invalid transitions with deterministic conflict error.
- `rulesEngine.service.ts`:
  - Resolve effective `calendar_rule_set` + `paid_hours_policy`.
  - Evaluate day classification (public holiday, early knock-off, Friday short day, standard day).
  - Return deterministic rule decision bundle with trace.
- `timesheetCalculation.service.ts`:
  - Compute per-day normal/OT/PH-worked/leave minutes.
  - Produce weekly totals and period totals.
  - Produce validation issues (blocking vs warning).
- `payrollValidation.service.ts`:
  - Validate manager-approved timesheets.
  - Persist exceptions in `timesheet_exception`.
- `payrollExport.service.ts`:
  - Create traceable batch ID.
  - Snapshot eligible records.
  - Persist `payroll_export_batch` + `payroll_export_line`.
  - Ensure deterministic repeatability for same input snapshot.
- `audit.service.ts`:
  - Persist `audit_event` + `audit_field_change`.
  - Build before/after diffs for mutable entities.

### Repositories

- Encapsulate SQL and row mapping by aggregate.
- No business rules in repositories.
- Transactions controlled by services for multi-write operations.

### Security and Access

- `authJwt.middleware.ts`: validate access token and attach principal.
- `rbac.middleware.ts`: role guard by endpoint and optional scope checks (owner/manager-team/admin).
- `idempotency.middleware.ts`:
  - Required for side-effecting POST endpoints (submit, approve, reject, mark-validated, lock, create batch).
  - Persist request hash + response snapshot in `idempotency_keys`.

### Audit Logging Middleware

- `requestContext.middleware.ts` sets:
  - `request_id`, actor id, actor role, correlation id.
- `auditLog.middleware.ts`:
  - For mutating endpoints, capture old/new payloads (service-provided diff context).
  - Write immutable audit rows.

## 3) DB Migration Plan

### Already in repository

1. `001_init_timesheet_schema.sql`
  - Core schema, enums, constraints, indexes, FK graph.
2. `002_guards_and_triggers.sql`
  - `updated_at` triggers.
  - Audit append-only protection.
  - Locked timesheet mutation protection.

### Next recommended migrations

3. `003_seed_baseline_rules.sql`
  - Seed baseline `calendar_rule_set`, public holidays, paid-hours default policies, leave codes.
4. `004_reporting_views.sql`
  - Read views for manager queue, payroll exception dashboard, audit-friendly views.
5. `005_idempotency_keys.sql`
  - Create `idempotency_keys` table:
    - `key`, `route`, `method`, `actor_id`, `request_hash`, `status_code`, `response_json`, timestamps.
    - Unique key by (`key`, `actor_id`, `route`, `method`).
6. `006_auth_refresh_sessions.sql`
  - Refresh session store with token family, rotation metadata, revoke flags.
7. `007_perf_indexes.sql`
  - Hot-path indexes discovered via query plans in staging.

### Migration execution and safety

- Use transactional migrations.
- Forward-only migration policy.
- No destructive table rewrites on locked/audited entities without explicit data migration scripts.
- Historical correctness:
  - Never mutate published rulesets.
  - Pin timesheet headers to `rule_set_id`, `paid_hours_policy_id`, `rule_snapshot_hash`.

## 4) Pseudocode for Rules Evaluation and Timesheet Calculation

### 4.1 Rules resolution (deterministic)

```ts
function resolveRuleContext(employeeId: number, periodId: number, workDate: string): RuleContext {
  const period = periodRepo.getById(periodId);                     // has rule_set_id
  const ruleSet = rulesRepo.getPublishedById(period.rule_set_id);
  const paidPolicy = rulesRepo.getEffectivePaidHoursPolicy(employeeId, workDate, ruleSet.id);
  const holidays = rulesRepo.getHolidayMap(ruleSet.id);
  const specialRules = rulesRepo.getSpecialDayRules(ruleSet.id, workDate);

  // deterministic precedence
  // PH > EARLY_KNOCK_OFF > FRIDAY_SHORT_DAY > STANDARD
  const dayType = classifyDay(workDate, holidays, specialRules);

  return {
    period,
    ruleSet,
    paidPolicy,
    dayType,
    trace: {
      rule_set_id: ruleSet.id,
      policy_id: paidPolicy.id,
      precedence: ["PUBLIC_HOLIDAY", "EARLY_KNOCK_OFF", "FRIDAY_SHORT_DAY", "STANDARD"]
    }
  };
}
```

### 4.2 Day-entry validation and calculation

```ts
function evaluateDayEntry(entry: DayEntryInput, ctx: RuleContext): DayResult {
  const errors: ValidationIssue[] = [];

  if (entry.absence_code) {
    if (entry.start_local || entry.end_local) {
      errors.push(err("INVALID_COMBO", "start_local", "Start/Finish must be blank when absence code is selected."));
    }
  }

  if (!entry.absence_code) {
    if (!entry.start_local || !entry.end_local) {
      errors.push(err("MISSING_TIME", "start_local", "Start and Finish are required for worked entries."));
    } else if (entry.end_local <= entry.start_local) {
      errors.push(err("TIME_ORDER", "end_local", "Finish must be after Start."));
    }
  }

  if (ctx.dayType === "PUBLIC_HOLIDAY" && !entry.start_local && !entry.end_local && entry.absence_code !== "PH") {
    errors.push(err("PH_CODE_REQUIRED", "absence_code", "Public holiday not worked must be coded as PH."));
  }

  const calc = calculateMinutes(entry, ctx);
  if (calc.normal < 0 || calc.ot < 0 || calc.phWorked < 0 || calc.leave < 0 || calc.total < 0) {
    errors.push(err("NEGATIVE_TOTAL", "row", "Negative totals are not allowed."));
  }

  if (calc.total > ctx.paidPolicy.max_daily_minutes) {
    errors.push(err("IMPOSSIBLE_HOURS", "row", "Impossible hours for one day."));
  }

  return {
    calc,
    errors,
    trace: {
      rule_set_id: ctx.ruleSet.id,
      paid_policy_id: ctx.paidPolicy.id,
      day_type: ctx.dayType
    }
  };
}
```

### 4.3 Aggregation and lifecycle gate

```ts
function recalculateTimesheet(headerId: number): RecalcResult {
  const header = timesheetRepo.getHeader(headerId);
  const entries = dayEntryRepo.listByHeader(headerId);

  const dayResults = entries.map((entry) => {
    const ctx = resolveRuleContext(header.employee_id, header.period_id, entry.work_date);
    return evaluateDayEntry(entry, ctx);
  });

  const weeklyTotals = groupByIsoWeek(dayResults).map(sumMinutes);
  const periodTotals = sumMinutes(dayResults);

  const blockingErrors = dayResults.flatMap((d) => d.errors.filter((e) => e.severity === "ERROR"));
  const warnings = dayResults.flatMap((d) => d.errors.filter((e) => e.severity === "WARNING"));

  timesheetRepo.saveComputedMinutes(headerId, dayResults, weeklyTotals, periodTotals);

  return { dayResults, weeklyTotals, periodTotals, blockingErrors, warnings };
}

function submitTimesheet(headerId: number, actor: Principal, rowVersion: number): TimesheetHeader {
  const header = timesheetRepo.getHeaderForUpdate(headerId);
  lifecycle.assertTransition(header.workflow_status, "SUBMITTED");
  lifecycle.assertEditableByActor(header, actor);
  lifecycle.assertRowVersion(header, rowVersion);

  const recalc = recalculateTimesheet(headerId);
  if (recalc.blockingErrors.length > 0) {
    throw conflict("BLOCKING_VALIDATIONS_PRESENT");
  }

  return tx(() => {
    const next = timesheetRepo.transition(headerId, "SUBMITTED", actor.id);
    approvalRepo.insertTransition(headerId, "SUBMIT", header.workflow_status, "SUBMITTED", actor.id);
    auditService.logTransition("timesheet_header", headerId, header.workflow_status, "SUBMITTED", actor);
    return next;
  });
}
```

## 5) Example Endpoints Implementation Skeletons

### 5.1 Route wiring

```ts
// src/routes/timesheet.routes.ts
router.post(
  "/v1/timesheets/:timesheetId/submit",
  authJwt(),
  rbac(["EMPLOYEE"]),
  idempotencyRequired(),
  timesheetController.submit
);

router.put(
  "/v1/timesheets/:timesheetId/day-entries",
  authJwt(),
  rbac(["EMPLOYEE", "ADMIN"]),
  timesheetController.upsertDayEntries
);
```

### 5.2 Controller skeleton

```ts
// src/controllers/timesheet.controller.ts
export const timesheetController = {
  async upsertDayEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const principal = req.auth!;
      const timesheetId = Number(req.params.timesheetId);
      const payload = validate(upsertDayEntriesSchema, req.body);

      const data = await timesheetService.upsertDayEntries({
        principal,
        timesheetId,
        rowVersion: payload.row_version,
        entries: payload.entries
      });

      return res.status(200).json(ok(data, req));
    } catch (err) {
      return next(err);
    }
  },

  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const principal = req.auth!;
      const timesheetId = Number(req.params.timesheetId);
      const payload = validate(submitSchema, req.body);

      const data = await timesheetService.submit({
        principal,
        timesheetId,
        rowVersion: payload.row_version,
        declarationAccepted: payload.declaration_accepted
      });

      return res.status(200).json(ok(data, req));
    } catch (err) {
      return next(err);
    }
  }
};
```

### 5.3 Service skeleton (lifecycle + calc + audit)

```ts
// src/services/timesheet.service.ts
export async function upsertDayEntries(input: UpsertDayEntriesInput) {
  return db.tx(async (trx) => {
    const header = await timesheetRepo.getHeaderForUpdate(trx, input.timesheetId);
    lifecycle.assertEditable(header.workflow_status);
    lifecycle.assertRoleForEdit(header, input.principal);
    lifecycle.assertRowVersion(header.row_version, input.rowVersion);

    await dayEntryRepo.upsertMany(trx, input.timesheetId, input.entries);
    const recalc = await timesheetCalculationService.recalculate(trx, input.timesheetId);

    await auditService.logEntityDiff(trx, {
      entityTable: "timesheet_day_entry",
      entityPk: String(input.timesheetId),
      actor: input.principal,
      operation: "UPDATE",
      before: recalc.beforeSnapshot,
      after: recalc.afterSnapshot
    });

    return recalc.response;
  });
}
```

### 5.4 Manager approval skeleton

```ts
// src/controllers/managerApproval.controller.ts
router.post(
  "/v1/manager/timesheets/:timesheetId/approve",
  authJwt(),
  rbac(["MANAGER"]),
  idempotencyRequired(),
  managerApprovalController.approve
);

// src/services/managerApproval.service.ts
export async function approve(input: ApproveInput) {
  return db.tx(async (trx) => {
    const h = await timesheetRepo.getHeaderForUpdate(trx, input.timesheetId);
    lifecycle.assertTransition(h.workflow_status, "MANAGER_APPROVED");
    if ((h.total_ot_minutes > 0 && !input.otConfirmed) || (h.total_ph_worked_minutes > 0 && !input.phConfirmed)) {
      throw validation("OT_OR_PH_CONFIRMATION_REQUIRED");
    }

    const updated = await timesheetRepo.transition(trx, h.id, "MANAGER_APPROVED", input.principal.id);
    await approvalRepo.insertTransition(trx, h.id, "MANAGER_APPROVE", h.workflow_status, "MANAGER_APPROVED", input.principal.id, input.notes);
    await auditService.logTransition(trx, "timesheet_header", String(h.id), h.workflow_status, "MANAGER_APPROVED", input.principal);
    return updated;
  });
}
```

### 5.5 Payroll export skeleton (traceable + repeatable)

```ts
// src/services/payrollExport.service.ts
export async function createBatch(input: CreateBatchInput) {
  return db.tx(async (trx) => {
    const eligible = await payrollRepo.listExportEligibleHeaders(trx, input.periodId, input.includeTimesheetIds);
    if (eligible.length === 0) throw conflict("PERIOD_NOT_EXPORT_READY");

    // Deterministic snapshot hash from ordered header ids + totals + ruleset
    const snapshotHash = hashSnapshot(eligible);

    // Repeatability: if existing batch for same period + snapshot hash exists, return it
    const existing = await payrollRepo.findBatchBySnapshot(trx, input.periodId, snapshotHash);
    if (existing) return existing;

    const batchId = await payrollRepo.nextBatchId(trx, input.periodId);
    const batch = await payrollRepo.insertBatch(trx, {
      batchId,
      periodId: input.periodId,
      snapshotHash,
      generatedBy: input.principal.id,
      exportFormat: input.exportFormat
    });

    const lines = buildExportLinesDeterministically(eligible);
    await payrollRepo.insertBatchLines(trx, batch.id, lines);

    await auditService.logEntityDiff(trx, {
      entityTable: "payroll_export_batch",
      entityPk: String(batch.id),
      actor: input.principal,
      operation: "EXPORT",
      before: null,
      after: { batch_id: batch.batch_id, snapshot_hash: snapshotHash, line_count: lines.length }
    });

    return { ...batch, line_count: lines.length };
  });
}
```

