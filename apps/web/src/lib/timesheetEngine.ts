export type WorkflowStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "MANAGER_APPROVED"
  | "MANAGER_REJECTED"
  | "PAYROLL_VALIDATED"
  | "LOCKED";

export type DayType = "WORKDAY" | "FRIDAY_SHORT_DAY" | "EARLY_KNOCK_OFF" | "PUBLIC_HOLIDAY";

export interface RuleSettings {
  fullDayMinutes: number;
  leavePaidMinutesDefault: number;
  fridayShortDayMinutes: number;
  earlyKnockOffPaidFullDay: boolean;
  earlyKnockOffDates: string[];
  publicHolidays: string[];
}

export interface DayEntry {
  date: string;
  dayType: DayType;
  startLocal: string;
  endLocal: string;
  breakMinutes: number;
  absenceCode: string;
  notes: string;
}

export interface DayCalculation {
  normalMinutes: number;
  overtimeMinutes: number;
  phWorkedMinutes: number;
  leaveMinutes: number;
  blockingErrors: string[];
  warnings: string[];
}

export interface TimesheetTotals {
  normalMinutes: number;
  overtimeMinutes: number;
  phWorkedMinutes: number;
  leaveMinutes: number;
  paidMinutes: number;
}

export interface TimesheetComputed {
  byDate: Record<string, DayCalculation>;
  weekly: Array<{ weekLabel: string; totals: TimesheetTotals }>;
  periodTotals: TimesheetTotals;
  hasBlockingErrors: boolean;
  requiresManagerApproval: boolean;
  exceptions: Array<{ code: string; severity: "ERROR" | "WARNING"; message: string; date?: string }>;
}

const ABSENCE_CODES = new Set(["AL", "SL", "LWOP", "PH"]);

function toMinutes(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return Number.NaN;
  }
  const parts = value.split(":");
  if (parts.length !== 2) {
    return Number.NaN;
  }
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return Number.NaN;
  }
  return hh * 60 + mm;
}

function weekLabel(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00`);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - yearStart.getTime()) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function zeroTotals(): TimesheetTotals {
  return {
    normalMinutes: 0,
    overtimeMinutes: 0,
    phWorkedMinutes: 0,
    leaveMinutes: 0,
    paidMinutes: 0
  };
}

function addTotals(a: TimesheetTotals, b: TimesheetTotals): TimesheetTotals {
  return {
    normalMinutes: a.normalMinutes + b.normalMinutes,
    overtimeMinutes: a.overtimeMinutes + b.overtimeMinutes,
    phWorkedMinutes: a.phWorkedMinutes + b.phWorkedMinutes,
    leaveMinutes: a.leaveMinutes + b.leaveMinutes,
    paidMinutes: a.paidMinutes + b.paidMinutes
  };
}

export function resolveDayType(date: string, settings: RuleSettings): DayType {
  if (settings.publicHolidays.includes(date)) {
    return "PUBLIC_HOLIDAY";
  }
  if (settings.earlyKnockOffDates.includes(date)) {
    return "EARLY_KNOCK_OFF";
  }
  const weekday = new Date(`${date}T00:00:00`).getDay();
  if (weekday === 5) {
    return "FRIDAY_SHORT_DAY";
  }
  return "WORKDAY";
}

export function calculateDayEntry(entry: DayEntry, settings: RuleSettings): DayCalculation {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  const absenceCode = entry.absenceCode.trim();
  const hasAbsence = absenceCode.length > 0;

  if (hasAbsence && !ABSENCE_CODES.has(absenceCode)) {
    blockingErrors.push("INVALID_ABSENCE_CODE");
  }

  if (hasAbsence && (entry.startLocal || entry.endLocal)) {
    blockingErrors.push("CODE_TIME_CONFLICT");
  }

  if (hasAbsence) {
    if (entry.dayType === "PUBLIC_HOLIDAY" && absenceCode !== "PH") {
      blockingErrors.push("PH_CODE_REQUIRED");
    }

    const leaveMinutes = absenceCode === "LWOP" ? 0 : settings.leavePaidMinutesDefault;
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes,
      blockingErrors,
      warnings
    };
  }

  if (!entry.startLocal && !entry.endLocal) {
    blockingErrors.push("MISSING_ENTRY_DAY");
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      blockingErrors,
      warnings
    };
  }

  if (!entry.startLocal || !entry.endLocal) {
    blockingErrors.push("TIME_PAIR_REQUIRED");
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      blockingErrors,
      warnings
    };
  }

  const startMinutes = toMinutes(entry.startLocal);
  const finishMinutes = toMinutes(entry.endLocal);

  if (!Number.isFinite(startMinutes) || !Number.isFinite(finishMinutes)) {
    blockingErrors.push("INVALID_TIME_FORMAT");
  }

  if (finishMinutes <= startMinutes) {
    blockingErrors.push("FINISH_BEFORE_START");
  }

  const workedMinutes = finishMinutes - startMinutes - entry.breakMinutes;

  if (workedMinutes < 0) {
    blockingErrors.push("NEGATIVE_TOTALS");
  }

  if (workedMinutes > 16 * 60) {
    blockingErrors.push("IMPOSSIBLE_HOURS");
  }

  if (blockingErrors.length > 0) {
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      blockingErrors,
      warnings
    };
  }

  if (entry.dayType === "PUBLIC_HOLIDAY") {
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: workedMinutes,
      leaveMinutes: 0,
      blockingErrors,
      warnings
    };
  }

  if (entry.dayType === "EARLY_KNOCK_OFF" && settings.earlyKnockOffPaidFullDay) {
    const normalMinutes = settings.fullDayMinutes;
    const overtimeMinutes = Math.max(0, workedMinutes - settings.fullDayMinutes);
    return {
      normalMinutes,
      overtimeMinutes,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      blockingErrors,
      warnings
    };
  }

  const normalCap = entry.dayType === "FRIDAY_SHORT_DAY" ? settings.fridayShortDayMinutes : settings.fullDayMinutes;
  const normalMinutes = Math.min(workedMinutes, normalCap);
  const overtimeMinutes = Math.max(0, workedMinutes - normalCap);

  return {
    normalMinutes,
    overtimeMinutes,
    phWorkedMinutes: 0,
    leaveMinutes: 0,
    blockingErrors,
    warnings
  };
}

export function calculateTimesheet(entries: DayEntry[], settings: RuleSettings): TimesheetComputed {
  const byDate: Record<string, DayCalculation> = {};
  const exceptions: Array<{ code: string; severity: "ERROR" | "WARNING"; message: string; date?: string }> = [];
  const weeklyMap = new Map<string, TimesheetTotals>();
  let periodTotals = zeroTotals();
  let hasBlockingErrors = false;
  let requiresManagerApproval = false;

  for (const entry of entries) {
    const result = calculateDayEntry(entry, settings);
    byDate[entry.date] = result;

    const dayTotals: TimesheetTotals = {
      normalMinutes: result.normalMinutes,
      overtimeMinutes: result.overtimeMinutes,
      phWorkedMinutes: result.phWorkedMinutes,
      leaveMinutes: result.leaveMinutes,
      paidMinutes: result.normalMinutes + result.overtimeMinutes + result.phWorkedMinutes + result.leaveMinutes
    };

    periodTotals = addTotals(periodTotals, dayTotals);

    const label = weekLabel(entry.date);
    const prior = weeklyMap.get(label) ?? zeroTotals();
    weeklyMap.set(label, addTotals(prior, dayTotals));

    for (const code of result.blockingErrors) {
      hasBlockingErrors = true;
      exceptions.push({
        code,
        severity: "ERROR",
        message: code,
        date: entry.date
      });
    }

    if (result.overtimeMinutes > 0) {
      requiresManagerApproval = true;
      exceptions.push({
        code: "OT_APPROVAL_REQUIRED",
        severity: "ERROR",
        message: "Overtime requires manager approval",
        date: entry.date
      });
    }

    if (result.phWorkedMinutes > 0) {
      requiresManagerApproval = true;
      exceptions.push({
        code: "PH_WORKED_APPROVAL_REQUIRED",
        severity: "ERROR",
        message: "Public holiday worked requires manager approval",
        date: entry.date
      });
    }
  }

  const weekly = Array.from(weeklyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, totals]) => ({ weekLabel: week, totals }));

  return {
    byDate,
    weekly,
    periodTotals,
    hasBlockingErrors,
    requiresManagerApproval,
    exceptions
  };
}

export function minutesToHoursString(minutes: number): string {
  return (minutes / 60).toFixed(2);
}
