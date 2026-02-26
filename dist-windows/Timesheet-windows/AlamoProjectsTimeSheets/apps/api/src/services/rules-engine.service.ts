import type { UpsertDayEntryInput } from "@timesheet/shared";

export interface RuleContext {
  fullDayMinutes: number;
  fridayShortDayMinutes: number;
  earlyKnockOffPaidFullDay: boolean;
  leaveDefaultPaidMinutes: number;
  publicHolidayCode: string;
}

export interface CalculatedMinutes {
  normalMinutes: number;
  overtimeMinutes: number;
  phWorkedMinutes: number;
  leaveMinutes: number;
  exceptions: string[];
}

function toMinutes(value: string): number {
  const [hh, mm] = value.split(":");
  const hours = Number(hh);
  const minutes = Number(mm);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.NaN;
  }

  return hours * 60 + minutes;
}

// Deterministic rules engine skeleton. This mirrors the documented matrix and
// audit requirements and returns explicit exceptions for invalid combinations.
export function calculateDayEntry(
  entry: UpsertDayEntryInput,
  context: RuleContext,
  dayTypeCode: string,
  managerApprovedOtPh: boolean
): CalculatedMinutes {
  if (entry.absenceCode && (entry.startLocal || entry.endLocal)) {
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      exceptions: ["CODE_TIME_CONFLICT"]
    };
  }

  if (!entry.startLocal && !entry.endLocal && entry.absenceCode) {
    const leaveMinutes = context.leaveDefaultPaidMinutes;
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes,
      exceptions: []
    };
  }

  if (!entry.startLocal || !entry.endLocal) {
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      exceptions: ["MISSING_ENTRY_DAY"]
    };
  }

  const startMinutes = toMinutes(entry.startLocal);
  const endMinutes = toMinutes(entry.endLocal);

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      exceptions: ["INVALID_TIME_FORMAT"]
    };
  }

  if (endMinutes <= startMinutes) {
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      exceptions: ["FINISH_BEFORE_START"]
    };
  }

  const rawWorked = endMinutes - startMinutes - entry.breakMinutes;

  if (rawWorked < 0 || rawWorked > 24 * 60) {
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: 0,
      leaveMinutes: 0,
      exceptions: ["IMPOSSIBLE_HOURS"]
    };
  }

  if (dayTypeCode === "PUBLIC_HOLIDAY") {
    const exceptions = managerApprovedOtPh ? [] : ["PH_WORKED_APPROVAL_REQUIRED"];
    return {
      normalMinutes: 0,
      overtimeMinutes: 0,
      phWorkedMinutes: rawWorked,
      leaveMinutes: 0,
      exceptions
    };
  }

  const normalCap = dayTypeCode === "FRIDAY_SHORT_DAY" ? context.fridayShortDayMinutes : context.fullDayMinutes;
  const normalMinutes = Math.min(rawWorked, normalCap);
  const overtimeMinutes = Math.max(0, rawWorked - normalCap);

  const exceptions = overtimeMinutes > 0 && !managerApprovedOtPh ? ["OT_APPROVAL_REQUIRED"] : [];

  return {
    normalMinutes,
    overtimeMinutes,
    phWorkedMinutes: 0,
    leaveMinutes: 0,
    exceptions
  };
}
