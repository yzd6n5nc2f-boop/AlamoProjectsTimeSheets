export type WorkflowStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "MANAGER_APPROVED"
  | "MANAGER_REJECTED"
  | "PAYROLL_VALIDATED"
  | "LOCKED";

export type DayType = "WORKDAY" | "FRIDAY_SHORT_DAY" | "EARLY_KNOCK_OFF" | "PUBLIC_HOLIDAY" | "WEEKEND";

export interface RuleSettings {
  fullDayMinutes: number;
  leavePaidMinutesDefault: number;
  fridayShortDayMinutes: number;
  earlyKnockOffPaidFullDay: boolean;
  earlyKnockOffDates: string[];
  publicHolidays: string[];
}

export interface ProjectLine {
  id: string;
  projectDescription: string;
  hours: number;
}

export interface DayEntry {
  date: string;
  dayType: DayType;
  projectLines: ProjectLine[];
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

export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDayType(date: string, settings: RuleSettings): DayType {
  if (settings.publicHolidays.includes(date)) {
    return "PUBLIC_HOLIDAY";
  }

  const weekday = new Date(`${date}T00:00:00`).getDay();

  if (weekday === 0 || weekday === 6) {
    return "WEEKEND";
  }

  if (settings.earlyKnockOffDates.includes(date)) {
    return "EARLY_KNOCK_OFF";
  }

  if (weekday === 5) {
    return "FRIDAY_SHORT_DAY";
  }

  return "WORKDAY";
}

export function sumProjectHours(entry: DayEntry): number {
  return entry.projectLines.reduce((sum, line) => sum + (Number.isFinite(line.hours) ? line.hours : 0), 0);
}

export function calculateDayEntry(entry: DayEntry, settings: RuleSettings, todayIso: string): DayCalculation {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  const absenceCode = entry.absenceCode.trim();
  const hasAbsence = absenceCode.length > 0;

  if (hasAbsence && !ABSENCE_CODES.has(absenceCode)) {
    blockingErrors.push("INVALID_ABSENCE_CODE");
  }

  for (const line of entry.projectLines) {
    if (line.hours < 0) {
      blockingErrors.push("NEGATIVE_TOTALS");
      break;
    }
  }

  const workedHours = sumProjectHours(entry);
  const workedMinutes = Math.round(workedHours * 60);

  if (hasAbsence && workedMinutes > 0) {
    blockingErrors.push("CODE_HOURS_CONFLICT");
  }

  if (workedMinutes > 16 * 60) {
    blockingErrors.push("IMPOSSIBLE_HOURS");
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

  if (workedMinutes === 0) {
    const isFutureDay = entry.date > todayIso;

    if (!isFutureDay) {
      if (entry.dayType === "PUBLIC_HOLIDAY") {
        blockingErrors.push("PH_CODE_REQUIRED");
      } else {
        blockingErrors.push("MISSING_ENTRY_DAY");
      }
    }

    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      blockingErrors,
      warnings
    };
  }

  for (const line of entry.projectLines) {
    if (line.hours > 0 && line.projectDescription.trim().length === 0) {
      blockingErrors.push("PROJECT_DESCRIPTION_REQUIRED");
      break;
    }
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

  if (entry.dayType === "WEEKEND") {
    return {
      normalMinutes: 0,
      overtimeMinutes: workedMinutes,
      phWorkedMinutes: 0,
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

export function calculateTimesheet(entries: DayEntry[], settings: RuleSettings, todayIso = getTodayIso()): TimesheetComputed {
  const byDate: Record<string, DayCalculation> = {};
  const exceptions: Array<{ code: string; severity: "ERROR" | "WARNING"; message: string; date?: string }> = [];
  const weeklyMap = new Map<string, TimesheetTotals>();
  let periodTotals = zeroTotals();
  let hasBlockingErrors = false;
  let requiresManagerApproval = false;

  for (const entry of entries) {
    const result = calculateDayEntry(entry, settings, todayIso);
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

export function monthLabel(monthKey: string): string {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
