# Timesheet Calculation Engine Design (Implementation Level)

Product: **Timesheet**  
Subtitle: **for Alamo Projects**

## 1) Scope

### Inputs

- Employee context (timezone, policy assignment, role context).
- Day entry (start/finish, break, absence/leave code, notes).
- Calendar day-type context (workday, Friday short day, early knock-off, public holiday).
- Rule snapshot/settings (rounding, targets, leave defaults, thresholds).
- Approval context (manager OT/PH confirmations).

### Outputs

- `normal_hours`
- `overtime_hours`
- `ph_worked_hours`
- `leave_hours_by_code`
- `exceptions` (blocking/warning with rule codes and field paths)
- weekly totals and period totals

## 2) Step-by-Step Evaluation Order

Deterministic order is mandatory and must not vary by runtime.

1. Resolve immutable calculation context
  - Load effective rule snapshot by `(timesheet_header.rule_set_id, paid_hours_policy_id)`.
  - Resolve employee timezone and day-type for `work_date`.
  - Build `calc_trace` metadata (`rule_set_id`, `policy_id`, `engine_version`).
2. Normalize input
  - Trim/normalize code values, parse times, default missing break to `0`.
  - Convert work interval to raw minutes in employee timezone.
3. Determine row mode
  - `CODE_MODE` if `absence_code` present.
  - `TIME_MODE` if both start and finish present.
  - `EMPTY_MODE` otherwise.
4. Structural validation (pre-calc)
  - If code and time both present: `CODE_TIME_CONFLICT` blocking error.
  - If one time missing: `TIME_PAIR_REQUIRED` blocking error.
  - If finish <= start: `FINISH_BEFORE_START` blocking error.
  - If break < 0 or break >= interval: `INVALID_BREAK` blocking error.
5. Calendar-day specific validation
  - If day type is PH and not worked, absence code must be `PH`.
  - If `absence_code='PH'` and times present: invalid combo.
6. Minute calculation
  - Compute raw worked minutes for `TIME_MODE`.
  - Apply deterministic rounding (section 3).
  - Apply day-type policy split into normal/OT/PH worked.
  - Apply leave policy mapping in `CODE_MODE` to `leave_hours_by_code`.
7. Post-calc validation
  - No negative buckets.
  - Max-day checks (`IMPOSSIBLE_HOURS`) from policy.
8. Approval-derived exceptions
  - If OT > 0 or PH worked > 0 and manager confirmation missing:
    - Add exception `MANAGER_CONFIRMATION_REQUIRED` (approval-stage blocking).
9. Aggregate
  - Build weekly totals (configured week start; default Monday).
  - Build period totals from weekly totals.
10. Return result + trace
  - Include exceptions with severity/stage.
  - Persist computed minutes and `calc_trace` for auditability.

## 3) Rounding Rules

### 3.1 Canonical minute handling

- Internal calculations are minute-based integers.
- Export/UI hours are derived from minutes (`minutes / 60`, 2 decimals for display/export).

### 3.2 Rounding function

- Config:
  - `rounding_increment_minutes` (default `15`)
  - `rounding_mode`: `FLOOR | CEIL | NEAREST` (default `NEAREST`)

Apply rounding after subtracting break:

`rounded_worked = round_to_increment(raw_worked - break_minutes, increment, mode)`

### 3.3 Deterministic tie-break

- For `NEAREST`, half-increment ties round up.
- Example with 15-minute increment:
  - 7m -> 0m
  - 8m -> 15m
  - 22m -> 15m
  - 23m -> 30m

## 4) Conflict Resolution (Code vs Time)

### Rule precedence

1. Structural validity first.
2. Mode resolution second.
3. Day-type policy third.
4. Approval-stage constraints fourth.

### Conflict policy

- If `absence_code` and worked time coexist:
  - emit blocking exception `CODE_TIME_CONFLICT`.
  - row contributes `0` to all buckets until corrected (no silent auto-fix in engine).
- UI may auto-clear fields, but engine remains strict and explicit.

### Public holiday not worked

- `PUBLIC_HOLIDAY + no worked time` requires `absence_code='PH'`.
- Missing `PH` code yields blocking `PH_CODE_REQUIRED`.

## 5) Weekly and Period Totals

### 5.1 Daily buckets

- `normal_minutes`
- `ot_minutes`
- `ph_worked_minutes`
- `leave_minutes_by_code`

### 5.2 Weekly aggregation

- Group by ISO week (Monday start unless policy override).
- Sum all daily buckets.
- If weekly OT policy enabled:
  - `weekly_required_ot = max(0, weekly_worked_non_ph - weekly_normal_limit)`
  - `weekly_ot_topup = max(0, weekly_required_ot - sum(daily_ot))`
  - allocate top-up deterministically using configured strategy:
    - default `LAST_ELIGIBLE_DAY`

### 5.3 Period aggregation

- `period_normal = sum(weekly_normal)`
- `period_ot = sum(weekly_ot)`
- `period_ph_worked = sum(weekly_ph_worked)`
- `period_leave_by_code = merge_sum(weekly_leave_by_code)`
- `period_total_paid = normal + ot + ph_worked + leave_total`

## 6) Historical Correctness Snapshot Strategy

1. Pin context on timesheet header:
  - `rule_set_id`
  - `paid_hours_policy_id`
  - `rule_snapshot_hash`
2. Persist per-row calculation trace (`timesheet_day_entry.calc_trace`) containing:
  - effective rule IDs
  - rounding config
  - day-type resolution
  - engine version
3. Compute and store input signature hash:
  - canonical JSON of row input + resolved rule IDs + engine version
4. Recalculation rules:
  - allowed only for editable statuses (`DRAFT`, `MANAGER_REJECTED`, controlled revision)
  - locked timesheets never recalc in place
5. Rule changes:
  - new effective rows/version only
  - historical rows continue using pinned snapshot

## 7) Pseudocode

```text
function evaluateDayEntry(input):
  ctx = resolveSnapshot(input.employee, input.dayEntry.workDate, input.ruleSettings)
  exceptions = []

  normalized = normalize(input.dayEntry, ctx.timezone)
  mode = determineMode(normalized)  // CODE_MODE | TIME_MODE | EMPTY_MODE

  exceptions += validateStructural(normalized, mode)
  if hasBlocking(exceptions):
    return zeroResultWith(exceptions, ctx.trace)

  exceptions += validateCalendarSpecific(normalized, ctx.dayType)
  if hasBlocking(exceptions):
    return zeroResultWith(exceptions, ctx.trace)

  if mode == EMPTY_MODE:
    exceptions += validateMissingRequiredDay(normalized, ctx)
    return zeroResultWith(exceptions, ctx.trace)

  if mode == CODE_MODE:
    leaveMinutesByCode = computeLeaveMinutesByCode(normalized.absenceCode, normalized.leaveUnits, ctx)
    result = {
      normalMinutes: 0,
      otMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutesByCode
    }
  else if mode == TIME_MODE:
    rawWorked = diffMinutes(normalized.start, normalized.finish, ctx.timezone) - normalized.breakMinutes
    roundedWorked = applyRounding(rawWorked, ctx.roundingIncrement, ctx.roundingMode)
    result = splitWorkedMinutesByDayType(roundedWorked, ctx, normalized)

  exceptions += validatePostCalc(result, ctx)

  if (result.otMinutes > 0 or result.phWorkedMinutes > 0) and not input.approvals.managerConfirmedOTPH:
    exceptions += [exception("MANAGER_CONFIRMATION_REQUIRED", stage="MANAGER_REVIEW", severity="ERROR")]

  return {
    normalHours: toHours(result.normalMinutes),
    overtimeHours: toHours(result.otMinutes),
    phWorkedHours: toHours(result.phWorkedMinutes),
    leaveHoursByCode: toHoursMap(result.leaveMinutesByCode),
    exceptions,
    trace: ctx.trace
  }

function calculateTimesheet(entries):
  dayResults = []
  for each entry in entries ordered by workDate,lineNo:
    dayResults += evaluateDayEntry(entry)

  weeklyTotals = aggregateByWeek(dayResults)
  weeklyTotals = applyWeeklyOtTopup(weeklyTotals, policy)
  periodTotals = aggregatePeriod(weeklyTotals)

  return { dayResults, weeklyTotals, periodTotals }
```

## 8) TypeScript Function Signatures

```ts
export type RoundingMode = "FLOOR" | "CEIL" | "NEAREST";
export type DayType = "WORKDAY" | "FRIDAY_SHORT_DAY" | "EARLY_KNOCK_OFF" | "PUBLIC_HOLIDAY";
export type ExceptionSeverity = "ERROR" | "WARNING";
export type ExceptionStage = "ENTRY" | "MANAGER_REVIEW" | "PAYROLL_REVIEW";

export interface EmployeeContext {
  employeeId: number;
  employeeNumber: string;
  timezone: string;
  paidHoursPolicyId: number;
}

export interface DayEntryInput {
  workDate: string; // YYYY-MM-DD
  lineNo: number;
  startLocal: string | null; // HH:mm
  finishLocal: string | null; // HH:mm
  breakMinutes: number;
  absenceCode: string | null; // PH, AL, SL, etc.
  leaveUnits?: number; // default 1.0 when absence code is full day
  notes?: string | null;
}

export interface CalendarDayContext {
  dayType: DayType;
  isPublicHoliday: boolean;
  holidayName?: string;
}

export interface RuleSnapshot {
  ruleSetId: number;
  ruleSnapshotHash: string;
  engineVersion: string;
  roundingIncrementMinutes: number;
  roundingMode: RoundingMode;
  fullDayMinutes: number; // default 480
  fridayShortDayMinutes: number; // configurable
  earlyKnockOffMinutes: number; // configurable
  earlyKnockOffPaidFullDay: boolean;
  leaveDefaultPaidMinutesPerDay: number; // default 480
  phNotWorkedCode: string; // "PH"
  phNotWorkedPaidMinutes: number; // default 480
  maxDailyMinutes: number; // impossible-hours guard
  weekStartIsoDay: 1 | 2 | 3 | 4 | 5 | 6 | 7; // Monday=1
  weeklyOtEnabled: boolean;
  weeklyNormalLimitMinutes: number;
  weeklyOtAllocationStrategy: "LAST_ELIGIBLE_DAY" | "FIRST_ELIGIBLE_DAY";
}

export interface ApprovalContext {
  managerConfirmedOTPH: boolean;
}

export interface CalcException {
  code: string;
  message: string;
  fieldPath?: string;
  severity: ExceptionSeverity;
  stage: ExceptionStage;
  blocking: boolean;
}

export interface DayCalculationOutput {
  workDate: string;
  lineNo: number;
  normalMinutes: number;
  overtimeMinutes: number;
  phWorkedMinutes: number;
  leaveMinutesByCode: Record<string, number>;
  exceptions: CalcException[];
  trace: Record<string, unknown>;
}

export interface WeeklyTotals {
  weekKey: string; // YYYY-Www
  normalMinutes: number;
  overtimeMinutes: number;
  phWorkedMinutes: number;
  leaveMinutesByCode: Record<string, number>;
  totalPaidMinutes: number;
  exceptions: CalcException[];
}

export interface PeriodTotals {
  normalMinutes: number;
  overtimeMinutes: number;
  phWorkedMinutes: number;
  leaveMinutesByCode: Record<string, number>;
  totalPaidMinutes: number;
}

export interface TimesheetCalculationOutput {
  dayResults: DayCalculationOutput[];
  weeklyTotals: WeeklyTotals[];
  periodTotals: PeriodTotals;
  blockingExceptions: CalcException[];
  warnings: CalcException[];
}

export declare function evaluateDayEntry(
  employee: EmployeeContext,
  dayEntry: DayEntryInput,
  calendarDay: CalendarDayContext,
  rules: RuleSnapshot,
  approvals: ApprovalContext
): DayCalculationOutput;

export declare function calculateTimesheet(
  employee: EmployeeContext,
  dayEntries: DayEntryInput[],
  calendarByDate: Record<string, CalendarDayContext>,
  rules: RuleSnapshot,
  approvalsByDate: Record<string, ApprovalContext>
): TimesheetCalculationOutput;
```

## 9) Test Vectors

All expected outputs use hours for readability; engine stores minutes.

| TV | Input Summary | Expected Output |
|---|---|---|
| TV-01 Standard workday | WORKDAY, `08:00-16:30`, break `30`, no code | normal `8.00`, OT `0.00`, PH worked `0.00`, leave `{}` |
| TV-02 Daily overtime | WORKDAY, `08:00-18:00`, break `30` | normal `8.00`, OT `1.50`, exception `MANAGER_CONFIRMATION_REQUIRED` if unconfirmed |
| TV-03 Paid leave default | code `AL`, no time, leave units `1` | leave `{AL: 8.00}`, others `0.00` |
| TV-04 Code/time conflict | code `AL` + `09:00-17:00` | blocking `CODE_TIME_CONFLICT`; all hour buckets `0.00` |
| TV-05 PH not worked valid | PUBLIC_HOLIDAY, code `PH`, no time | leave `{PH: 8.00}`, others `0.00`, no blocking errors |
| TV-06 PH not worked invalid | PUBLIC_HOLIDAY, no time, no code | blocking `PH_CODE_REQUIRED`; all buckets `0.00` |
| TV-07 PH worked | PUBLIC_HOLIDAY, `09:00-17:00`, break `30` | PH worked `7.50`, normal `0.00`, OT `0.00`; manager confirmation required if unconfirmed |
| TV-08 Friday short day | FRIDAY_SHORT_DAY target `6h`, worked `7.5h` | normal `6.00`, OT `1.50` |
| TV-09 Early knock-off paid full | EARLY_KNOCK_OFF, pay-full-day `true`, worked `5h` | normal `8.00`, OT `0.00` |
| TV-10 Weekly OT top-up | 5 days each `8.5h`, daily target `8h`, weekly limit `40h` | weekly normal `40.00`, weekly OT `2.50`, period totals match weekly sums |

### Vector notes

- Rounding assumptions for vectors: increment `15`, mode `NEAREST`.
- For TV-10, if daily OT already equals weekly OT requirement, top-up is `0`.

