import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  calculateTimesheet,
  getTodayIso,
  monthLabel,
  resolveDayType,
  sumProjectHours,
  type DayEntry,
  type ProjectLine,
  type RuleSettings,
  type WorkflowStatus
} from "../lib/timesheetEngine";

export type AppRole = "EMPLOYEE" | "MANAGER" | "PAYROLL" | "ADMIN";

export interface ApprovalEvent {
  at: string;
  actor: string;
  action: string;
  note: string;
}

export interface ExportBatch {
  batchId: string;
  createdAt: string;
  lineCount: number;
  checksum: string;
}

export interface PlannedLeaveRecord {
  id: string;
  date: string;
  hours: number;
  note: string;
}

export interface ElectronicSignature {
  signedBy: string;
  signedAt: string;
  signatureHash: string;
  declaration: string;
  revisionNo: number;
}

interface MonthTimesheetState {
  status: WorkflowStatus;
  revisionNo: number;
  dayEntries: DayEntry[];
  approvals: ApprovalEvent[];
  exportBatches: ExportBatch[];
  managerNote: string;
  employeeSignature: ElectronicSignature | null;
  managerSignature: ElectronicSignature | null;
}

interface SqliteSyncState {
  state: "idle" | "loading" | "saving" | "ready" | "error";
  message: string;
  lastSavedAt: string | null;
}

interface AppStateValue {
  role: AppRole;
  setRole: (role: AppRole) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  currentDateIso: string;
  periodLabel: string;
  periodDisplayLabel: string;
  status: WorkflowStatus;
  revisionNo: number;
  ruleSettings: RuleSettings;
  dayEntries: DayEntry[];
  approvals: ApprovalEvent[];
  exportBatches: ExportBatch[];
  managerNote: string;
  setManagerNote: (value: string) => void;
  employeeSignature: ElectronicSignature | null;
  managerSignature: ElectronicSignature | null;
  computed: ReturnType<typeof calculateTimesheet>;
  sqliteSync: SqliteSyncState;
  updateDayEntry: (date: string, patch: Partial<DayEntry>) => void;
  addProjectLine: (date: string) => void;
  updateProjectLine: (date: string, lineId: string, patch: Partial<ProjectLine>) => void;
  removeProjectLine: (date: string, lineId: string) => void;
  signAsEmployee: (signedBy: string) => { ok: boolean; message: string };
  signAsManager: (signedBy: string) => { ok: boolean; message: string };
  submitTimesheet: () => { ok: boolean; message: string };
  managerApprove: () => { ok: boolean; message: string };
  managerReject: () => { ok: boolean; message: string };
  payrollValidate: () => { ok: boolean; message: string };
  lockPeriod: () => { ok: boolean; message: string };
  createExportBatch: () => { ok: boolean; message: string };
  updateRuleSettings: (patch: Partial<RuleSettings>) => void;
  annualLeaveEntitlementHours: number;
  plannedLeave: PlannedLeaveRecord[];
  addPlannedLeave: (payload: Omit<PlannedLeaveRecord, "id">) => { ok: boolean; message: string };
  removePlannedLeave: (id: string) => void;
  leaveSummary: {
    year: number;
    entitlementHours: number;
    takenHours: number;
    plannedHours: number;
    remainingAfterTaken: number;
    remainingAfterPlanned: number;
  };
}

const AppStateContext = createContext<AppStateValue | null>(null);

const INITIAL_RULES: RuleSettings = {
  fullDayMinutes: 480,
  leavePaidMinutesDefault: 480,
  fridayShortDayMinutes: 360,
  earlyKnockOffPaidFullDay: true,
  earlyKnockOffDates: ["2026-02-12"],
  publicHolidays: ["2026-01-01", "2026-01-26", "2026-02-10", "2026-04-03"]
};

const ANNUAL_LEAVE_ENTITLEMENT_HOURS = 152;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8080";
const EMPLOYEE_SIGNATURE_DECLARATION =
  "I certify this monthly timesheet is true and complete to the best of my knowledge.";
const MANAGER_SIGNATURE_DECLARATION =
  "I approve this monthly timesheet after review and confirm approvals for overtime/public holiday work where required.";

function nowIso(): string {
  return new Date().toISOString();
}

function currentMonthKey(): string {
  return getTodayIso().slice(0, 7);
}

function daysInMonth(monthKey: string): number {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return new Date(year, month, 0).getDate();
}

function createProjectLine(hours = 0, projectDescription = ""): ProjectLine {
  return {
    id: `PL-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    projectDescription,
    hours
  };
}

function buildMonthEntries(monthKey: string, settings: RuleSettings, todayIso: string): DayEntry[] {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const totalDays = daysInMonth(monthKey);

  const entries: DayEntry[] = [];

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00`).getDay();

    // Show only Monday-Friday rows.
    if (weekday === 0 || weekday === 6) {
      continue;
    }

    const dayType = resolveDayType(date, settings);
    const isPastOrCurrent = date <= todayIso;

    if (dayType === "PUBLIC_HOLIDAY") {
      entries.push({
        date,
        dayType,
        projectLines: [],
        absenceCode: "PH",
        notes: "Public holiday"
      });
      continue;
    }

    if (!isPastOrCurrent) {
      entries.push({
        date,
        dayType,
        projectLines: [createProjectLine(0, "")],
        absenceCode: "",
        notes: ""
      });
      continue;
    }

    entries.push({
      date,
      dayType,
      projectLines: [createProjectLine(dayType === "FRIDAY_SHORT_DAY" ? 6 : 8, "General Project Work")],
      absenceCode: "",
      notes: ""
    });
  }

  return entries;
}

function buildMonthState(monthKey: string, settings: RuleSettings, todayIso: string): MonthTimesheetState {
  return {
    status: "DRAFT",
    revisionNo: 1,
    dayEntries: buildMonthEntries(monthKey, settings, todayIso),
    approvals: [],
    exportBatches: [],
    managerNote: "",
    employeeSignature: null,
    managerSignature: null
  };
}

function normalizeSignature(rawSignature: unknown): ElectronicSignature | null {
  if (!rawSignature || typeof rawSignature !== "object") {
    return null;
  }

  const raw = rawSignature as {
    signedBy?: unknown;
    signedAt?: unknown;
    signatureHash?: unknown;
    declaration?: unknown;
    revisionNo?: unknown;
  };

  const signedBy = typeof raw.signedBy === "string" ? raw.signedBy.trim() : "";
  const signatureHash = typeof raw.signatureHash === "string" ? raw.signatureHash.trim() : "";

  if (signedBy.length === 0 || signatureHash.length === 0) {
    return null;
  }

  return {
    signedBy,
    signedAt: typeof raw.signedAt === "string" ? raw.signedAt : "",
    signatureHash,
    declaration: typeof raw.declaration === "string" ? raw.declaration : "",
    revisionNo: Number.isFinite(Number(raw.revisionNo)) ? Number(raw.revisionNo) : 1
  };
}

function signatureEntriesSnapshot(entries: DayEntry[]): unknown[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      date: entry.date,
      absenceCode: entry.absenceCode.trim(),
      notes: entry.notes.trim(),
      projectLines: [...entry.projectLines]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((line) => ({
          projectDescription: line.projectDescription.trim(),
          hours: Number(line.hours.toFixed(2))
        }))
    }));
}

function buildSignatureHash(
  role: "EMPLOYEE" | "MANAGER",
  signedBy: string,
  monthKey: string,
  monthState: MonthTimesheetState,
  declaration: string,
  managerNote: string
): string {
  const payload = JSON.stringify({
    role,
    monthKey,
    revisionNo: monthState.revisionNo,
    status: monthState.status,
    signedBy: signedBy.trim(),
    declaration,
    managerNote: managerNote.trim(),
    dayEntries: signatureEntriesSnapshot(monthState.dayEntries),
    employeeSignatureHash: monthState.employeeSignature?.signatureHash ?? null
  });

  return hashForBatch(payload);
}

function normalizeProjectLines(rawProjectLines: unknown): ProjectLine[] {
  if (Array.isArray(rawProjectLines)) {
    return rawProjectLines
      .map((raw) => raw as { id?: unknown; projectDescription?: unknown; hours?: unknown })
      .map((line) => ({
        id: typeof line.id === "string" && line.id.length > 0 ? line.id : createProjectLine().id,
        projectDescription: typeof line.projectDescription === "string" ? line.projectDescription : "",
        hours: Number.isFinite(Number(line.hours)) ? Number(line.hours) : 0
      }));
  }

  return [];
}

function normalizeMonthState(
  monthKey: string,
  rawState: unknown,
  settings: RuleSettings,
  todayIso: string
): MonthTimesheetState {
  const fallback = buildMonthState(monthKey, settings, todayIso);
  const raw = rawState as {
    status?: unknown;
    revisionNo?: unknown;
    dayEntries?: unknown;
    approvals?: unknown;
    exportBatches?: unknown;
    managerNote?: unknown;
    employeeSignature?: unknown;
    managerSignature?: unknown;
  };

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const baseEntries = Array.isArray(raw.dayEntries) ? raw.dayEntries : fallback.dayEntries;
  const normalizedEntries: DayEntry[] = baseEntries.map((entryRaw) => {
    const entry = entryRaw as {
      date?: unknown;
      dayType?: unknown;
      projectLines?: unknown;
      projectDescription?: unknown;
      hoursWorked?: unknown;
      absenceCode?: unknown;
      notes?: unknown;
    };

    const date = typeof entry.date === "string" ? entry.date : fallback.dayEntries[0]?.date ?? `${monthKey}-01`;
    const dayType = resolveDayType(date, settings);

    // Backward compatibility with older single-project schema.
    const legacyProjectLines =
      typeof entry.projectDescription === "string" || Number.isFinite(Number(entry.hoursWorked))
        ? [createProjectLine(Number(entry.hoursWorked) || 0, typeof entry.projectDescription === "string" ? entry.projectDescription : "")]
        : [];

    const normalizedLines = normalizeProjectLines(entry.projectLines);

    return {
      date,
      dayType,
      projectLines: normalizedLines.length > 0 ? normalizedLines : legacyProjectLines,
      absenceCode: typeof entry.absenceCode === "string" ? entry.absenceCode : "",
      notes: typeof entry.notes === "string" ? entry.notes : ""
    };
  });

  const dayEntries = normalizedEntries.filter((entry) => {
    const weekday = new Date(`${entry.date}T00:00:00`).getDay();
    return weekday !== 0 && weekday !== 6;
  });

  const revisionNo = Number.isFinite(Number(raw.revisionNo)) ? Number(raw.revisionNo) : fallback.revisionNo;
  const employeeSignature = normalizeSignature(raw.employeeSignature);
  const managerSignature = normalizeSignature(raw.managerSignature);

  return {
    status:
      raw.status === "DRAFT" ||
      raw.status === "SUBMITTED" ||
      raw.status === "MANAGER_APPROVED" ||
      raw.status === "MANAGER_REJECTED" ||
      raw.status === "PAYROLL_VALIDATED" ||
      raw.status === "LOCKED"
        ? raw.status
        : fallback.status,
    revisionNo,
    dayEntries: dayEntries.length > 0 ? dayEntries : fallback.dayEntries,
    approvals: Array.isArray(raw.approvals) ? (raw.approvals as ApprovalEvent[]) : fallback.approvals,
    exportBatches: Array.isArray(raw.exportBatches) ? (raw.exportBatches as ExportBatch[]) : fallback.exportBatches,
    managerNote: typeof raw.managerNote === "string" ? raw.managerNote : fallback.managerNote,
    employeeSignature: employeeSignature && employeeSignature.revisionNo === revisionNo ? employeeSignature : null,
    managerSignature: managerSignature && managerSignature.revisionNo === revisionNo ? managerSignature : null
  };
}

function buildBatchId(monthKey: string): string {
  const timestamp = Date.now();
  return `TSB-${monthKey.replace("-", "")}-${timestamp}`;
}

function hashForBatch(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [role, setRole] = useState<AppRole>("EMPLOYEE");
  const [ruleSettings, setRuleSettings] = useState<RuleSettings>(INITIAL_RULES);
  const [currentDateIso] = useState<string>(getTodayIso());
  const [selectedMonth, setSelectedMonthState] = useState<string>(currentMonthKey());
  const [sqliteSync, setSqliteSync] = useState<SqliteSyncState>({
    state: "idle",
    message: "",
    lastSavedAt: null
  });

  const [months, setMonths] = useState<Record<string, MonthTimesheetState>>(() => {
    const month = currentMonthKey();
    return {
      [month]: buildMonthState(month, INITIAL_RULES, getTodayIso())
    };
  });

  const [plannedLeave, setPlannedLeave] = useState<PlannedLeaveRecord[]>([]);
  const [hydratedFromSqlite, setHydratedFromSqlite] = useState(false);

  const currentMonthData = months[selectedMonth] ?? buildMonthState(selectedMonth, ruleSettings, currentDateIso);

  const computed = useMemo(
    () => calculateTimesheet(currentMonthData.dayEntries, ruleSettings, currentDateIso),
    [currentMonthData.dayEntries, currentDateIso, ruleSettings]
  );

  const updateCurrentMonth = useCallback(
    (updater: (month: MonthTimesheetState) => MonthTimesheetState) => {
      setMonths((prior) => {
        const month = prior[selectedMonth] ?? buildMonthState(selectedMonth, ruleSettings, currentDateIso);
        return {
          ...prior,
          [selectedMonth]: updater(month)
        };
      });
    },
    [currentDateIso, ruleSettings, selectedMonth]
  );

  const setSelectedMonth = useCallback(
    (month: string) => {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return;
      }

      setMonths((prior) => {
        if (prior[month]) {
          return prior;
        }
        return {
          ...prior,
          [month]: buildMonthState(month, ruleSettings, currentDateIso)
        };
      });
      setSelectedMonthState(month);
    },
    [currentDateIso, ruleSettings]
  );

  const updateDayEntry = useCallback(
    (date: string, patch: Partial<DayEntry>) => {
      if (!(currentMonthData.status === "DRAFT" || currentMonthData.status === "MANAGER_REJECTED")) {
        return;
      }

      updateCurrentMonth((monthState) => ({
        ...monthState,
        employeeSignature: null,
        managerSignature: null,
        dayEntries: monthState.dayEntries.map((entry) => {
          if (entry.date !== date) {
            return entry;
          }

          const next = { ...entry, ...patch };

          if (
            Object.prototype.hasOwnProperty.call(patch, "absenceCode") &&
            typeof patch.absenceCode === "string" &&
            patch.absenceCode.length > 0
          ) {
            next.projectLines = [];
          }

          if (next.absenceCode.length === 0 && next.projectLines.length === 0) {
            next.projectLines = [createProjectLine(0, "")];
          }

          next.dayType = resolveDayType(next.date, ruleSettings);
          return next;
        })
      }));
    },
    [currentMonthData.status, ruleSettings, updateCurrentMonth]
  );

  const addProjectLine = useCallback(
    (date: string) => {
      if (!(currentMonthData.status === "DRAFT" || currentMonthData.status === "MANAGER_REJECTED")) {
        return;
      }

      updateCurrentMonth((monthState) => ({
        ...monthState,
        employeeSignature: null,
        managerSignature: null,
        dayEntries: monthState.dayEntries.map((entry) => {
          if (entry.date !== date) {
            return entry;
          }

          return {
            ...entry,
            absenceCode: "",
            projectLines: [...entry.projectLines, createProjectLine(0, "")]
          };
        })
      }));
    },
    [currentMonthData.status, updateCurrentMonth]
  );

  const updateProjectLine = useCallback(
    (date: string, lineId: string, patch: Partial<ProjectLine>) => {
      if (!(currentMonthData.status === "DRAFT" || currentMonthData.status === "MANAGER_REJECTED")) {
        return;
      }

      updateCurrentMonth((monthState) => ({
        ...monthState,
        employeeSignature: null,
        managerSignature: null,
        dayEntries: monthState.dayEntries.map((entry) => {
          if (entry.date !== date) {
            return entry;
          }

          const projectLines = entry.projectLines.map((line) => (line.id === lineId ? { ...line, ...patch } : line));
          const workedHours = projectLines.reduce((sum, line) => sum + line.hours, 0);

          return {
            ...entry,
            absenceCode: workedHours > 0 ? "" : entry.absenceCode,
            projectLines
          };
        })
      }));
    },
    [currentMonthData.status, updateCurrentMonth]
  );

  const removeProjectLine = useCallback(
    (date: string, lineId: string) => {
      if (!(currentMonthData.status === "DRAFT" || currentMonthData.status === "MANAGER_REJECTED")) {
        return;
      }

      updateCurrentMonth((monthState) => ({
        ...monthState,
        employeeSignature: null,
        managerSignature: null,
        dayEntries: monthState.dayEntries.map((entry) => {
          if (entry.date !== date) {
            return entry;
          }

          const remaining = entry.projectLines.filter((line) => line.id !== lineId);

          if (remaining.length > 0 || entry.absenceCode.length > 0) {
            return {
              ...entry,
              projectLines: remaining
            };
          }

          return {
            ...entry,
            projectLines: [createProjectLine(0, "")]
          };
        })
      }));
    },
    [currentMonthData.status, updateCurrentMonth]
  );

  const signAsEmployee = useCallback(
    (signedBy: string) => {
      const signer = signedBy.trim();

      if (!(currentMonthData.status === "DRAFT" || currentMonthData.status === "MANAGER_REJECTED")) {
        return { ok: false, message: "Employee signing is only available in Draft or Rejected status." };
      }

      if (computed.hasBlockingErrors) {
        return { ok: false, message: "Fix validation errors before signing." };
      }

      if (signer.length < 3) {
        return { ok: false, message: "Enter the employee full name for electronic signature." };
      }

      const signedAt = nowIso();

      updateCurrentMonth((monthState) => {
        const signatureHash = buildSignatureHash(
          "EMPLOYEE",
          signer,
          selectedMonth,
          monthState,
          EMPLOYEE_SIGNATURE_DECLARATION,
          monthState.managerNote
        );

        return {
          ...monthState,
          employeeSignature: {
            signedBy: signer,
            signedAt,
            signatureHash,
            declaration: EMPLOYEE_SIGNATURE_DECLARATION,
            revisionNo: monthState.revisionNo
          },
          managerSignature: null,
          approvals: [
            ...monthState.approvals,
            {
              at: signedAt,
              actor: "Employee",
              action: "EMPLOYEE_E_SIGN",
              note: `Employee e-signed by ${signer}; hash ${signatureHash}`
            }
          ]
        };
      });

      return { ok: true, message: "Employee electronic signature captured." };
    },
    [computed.hasBlockingErrors, currentMonthData.status, selectedMonth, updateCurrentMonth]
  );

  const signAsManager = useCallback(
    (signedBy: string) => {
      const signer = signedBy.trim();

      if (currentMonthData.status !== "SUBMITTED") {
        return { ok: false, message: "Manager signing is only available for submitted timesheets." };
      }

      if (!currentMonthData.employeeSignature || currentMonthData.employeeSignature.revisionNo !== currentMonthData.revisionNo) {
        return { ok: false, message: "Valid employee electronic signature is required before manager signing." };
      }

      if (signer.length < 3) {
        return { ok: false, message: "Enter the manager full name for electronic signature." };
      }

      const signedAt = nowIso();

      updateCurrentMonth((monthState) => {
        const signatureHash = buildSignatureHash(
          "MANAGER",
          signer,
          selectedMonth,
          monthState,
          MANAGER_SIGNATURE_DECLARATION,
          monthState.managerNote
        );

        return {
          ...monthState,
          managerSignature: {
            signedBy: signer,
            signedAt,
            signatureHash,
            declaration: MANAGER_SIGNATURE_DECLARATION,
            revisionNo: monthState.revisionNo
          },
          approvals: [
            ...monthState.approvals,
            {
              at: signedAt,
              actor: "Manager",
              action: "MANAGER_E_SIGN",
              note: `Manager e-signed by ${signer}; hash ${signatureHash}`
            }
          ]
        };
      });

      return { ok: true, message: "Manager electronic signature captured." };
    },
    [currentMonthData.employeeSignature, currentMonthData.revisionNo, currentMonthData.status, selectedMonth, updateCurrentMonth]
  );

  const submitTimesheet = useCallback(() => {
    if (!(currentMonthData.status === "DRAFT" || currentMonthData.status === "MANAGER_REJECTED")) {
      return { ok: false, message: "Only Draft or Rejected timesheets can be submitted." };
    }

    if (computed.hasBlockingErrors) {
      return { ok: false, message: "Fix validation errors before submit." };
    }

    if (!currentMonthData.employeeSignature || currentMonthData.employeeSignature.revisionNo !== currentMonthData.revisionNo) {
      return { ok: false, message: "Employee electronic signature is required before submit." };
    }

    updateCurrentMonth((monthState) => ({
      ...monthState,
      status: "SUBMITTED",
      managerSignature: null,
      approvals: [
        ...monthState.approvals,
        {
          at: nowIso(),
          actor: "Employee",
          action: "SUBMIT",
          note: `Monthly timesheet submitted for ${selectedMonth}`
        }
      ]
    }));

    return { ok: true, message: "Timesheet submitted." };
  }, [computed.hasBlockingErrors, currentMonthData.employeeSignature, currentMonthData.revisionNo, currentMonthData.status, selectedMonth, updateCurrentMonth]);

  const managerApprove = useCallback(() => {
    if (currentMonthData.status !== "SUBMITTED") {
      return { ok: false, message: "Manager can approve only submitted timesheets." };
    }

    if (!currentMonthData.managerSignature || currentMonthData.managerSignature.revisionNo !== currentMonthData.revisionNo) {
      return { ok: false, message: "Manager electronic signature is required before approval." };
    }

    if (computed.requiresManagerApproval && currentMonthData.managerNote.trim().length === 0) {
      return { ok: false, message: "Add manager confirmation note for OT/PH approval." };
    }

    updateCurrentMonth((monthState) => ({
      ...monthState,
      status: "MANAGER_APPROVED",
      approvals: [
        ...monthState.approvals,
        {
          at: nowIso(),
          actor: "Manager",
          action: "MANAGER_APPROVE",
          note: monthState.managerNote || "Approved"
        }
      ]
    }));

    return { ok: true, message: "Manager approved." };
  }, [
    computed.requiresManagerApproval,
    currentMonthData.managerNote,
    currentMonthData.managerSignature,
    currentMonthData.revisionNo,
    currentMonthData.status,
    updateCurrentMonth
  ]);

  const managerReject = useCallback(() => {
    if (currentMonthData.status !== "SUBMITTED") {
      return { ok: false, message: "Manager can reject only submitted timesheets." };
    }

    if (currentMonthData.managerNote.trim().length < 5) {
      return { ok: false, message: "Rejection note is required." };
    }

    updateCurrentMonth((monthState) => ({
      ...monthState,
      status: "MANAGER_REJECTED",
      revisionNo: monthState.revisionNo + 1,
      employeeSignature: null,
      managerSignature: null,
      approvals: [
        ...monthState.approvals,
        {
          at: nowIso(),
          actor: "Manager",
          action: "MANAGER_REJECT",
          note: monthState.managerNote
        }
      ]
    }));

    return { ok: true, message: "Manager rejected. Employee can edit and resubmit." };
  }, [currentMonthData.managerNote, currentMonthData.status, updateCurrentMonth]);

  const payrollValidate = useCallback(() => {
    if (currentMonthData.status !== "MANAGER_APPROVED") {
      return { ok: false, message: "Payroll validation requires manager approval first." };
    }

    if (!currentMonthData.employeeSignature || !currentMonthData.managerSignature) {
      return { ok: false, message: "Employee and manager electronic signatures are required before payroll validation." };
    }

    updateCurrentMonth((monthState) => ({
      ...monthState,
      status: "PAYROLL_VALIDATED",
      approvals: [
        ...monthState.approvals,
        {
          at: nowIso(),
          actor: "Payroll",
          action: "PAYROLL_VALIDATE",
          note: "All blocking exceptions resolved"
        }
      ]
    }));

    return { ok: true, message: "Payroll validated." };
  }, [currentMonthData.employeeSignature, currentMonthData.managerSignature, currentMonthData.status, updateCurrentMonth]);

  const lockPeriod = useCallback(() => {
    if (currentMonthData.status !== "PAYROLL_VALIDATED") {
      return { ok: false, message: "Only payroll-validated timesheets can be locked." };
    }

    updateCurrentMonth((monthState) => ({
      ...monthState,
      status: "LOCKED",
      approvals: [
        ...monthState.approvals,
        {
          at: nowIso(),
          actor: "Payroll",
          action: "LOCK",
          note: "Month locked"
        }
      ]
    }));

    return { ok: true, message: "Month locked." };
  }, [currentMonthData.status, updateCurrentMonth]);

  const createExportBatch = useCallback(() => {
    if (!(currentMonthData.status === "PAYROLL_VALIDATED" || currentMonthData.status === "LOCKED")) {
      return { ok: false, message: "Export requires payroll validated or locked status." };
    }

    const batchId = buildBatchId(selectedMonth);
    const signature = JSON.stringify({
      month: selectedMonth,
      revisionNo: currentMonthData.revisionNo,
      status: currentMonthData.status,
      totals: computed.periodTotals,
      entries: currentMonthData.dayEntries.map((entry) => ({
        date: entry.date,
        projectLines: entry.projectLines,
        absenceCode: entry.absenceCode
      })),
      employeeSignatureHash: currentMonthData.employeeSignature?.signatureHash ?? null,
      managerSignatureHash: currentMonthData.managerSignature?.signatureHash ?? null
    });

    const checksum = hashForBatch(signature);

    updateCurrentMonth((monthState) => ({
      ...monthState,
      exportBatches: [
        {
          batchId,
          createdAt: nowIso(),
          lineCount: monthState.dayEntries.filter((entry) => sumProjectHours(entry) > 0 || entry.absenceCode.length > 0).length,
          checksum
        },
        ...monthState.exportBatches
      ],
      approvals: [
        ...monthState.approvals,
        {
          at: nowIso(),
          actor: "Payroll",
          action: "EXPORT_BATCH",
          note: `Batch ${batchId}`
        }
      ]
    }));

    return { ok: true, message: `Export batch ${batchId} created.` };
  }, [
    computed.periodTotals,
    currentMonthData.dayEntries,
    currentMonthData.employeeSignature,
    currentMonthData.managerSignature,
    currentMonthData.revisionNo,
    currentMonthData.status,
    selectedMonth,
    updateCurrentMonth
  ]);

  const updateRuleSettings = useCallback(
    (patch: Partial<RuleSettings>) => {
      setRuleSettings((prior) => {
        const next = { ...prior, ...patch };

        setMonths((existingMonths) => {
          const updated: Record<string, MonthTimesheetState> = {};

          for (const [monthKey, monthState] of Object.entries(existingMonths)) {
            updated[monthKey] = {
              ...monthState,
              employeeSignature: monthState.status === "LOCKED" ? monthState.employeeSignature : null,
              managerSignature: monthState.status === "LOCKED" ? monthState.managerSignature : null,
              dayEntries: monthState.dayEntries.map((entry) => ({
                ...entry,
                dayType: resolveDayType(entry.date, next)
              }))
            };
          }

          return updated;
        });

        return next;
      });
    },
    []
  );

  const setManagerNote = useCallback(
    (value: string) => {
      updateCurrentMonth((monthState) => ({
        ...monthState,
        managerNote: value,
        managerSignature: monthState.managerNote === value ? monthState.managerSignature : null
      }));
    },
    [updateCurrentMonth]
  );

  const addPlannedLeave = useCallback((payload: Omit<PlannedLeaveRecord, "id">) => {
    if (!payload.date || payload.hours <= 0) {
      return { ok: false, message: "Date and hours are required." };
    }

    setPlannedLeave((prior) => [
      {
        id: `PL-${Date.now()}`,
        ...payload
      },
      ...prior
    ]);

    return { ok: true, message: "Planned leave recorded." };
  }, []);

  const removePlannedLeave = useCallback((id: string) => {
    setPlannedLeave((prior) => prior.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSqliteState() {
      setSqliteSync({ state: "loading", message: "Loading SQLite state...", lastSavedAt: null });

      try {
        const response = await fetch(`${API_BASE_URL}/v1/sqlite/state`);

        if (!response.ok) {
          throw new Error(`Load failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          data?: { months?: Record<string, MonthTimesheetState>; plannedLeave?: PlannedLeaveRecord[] };
        };

        if (cancelled) {
          return;
        }

        const loadedMonths = payload.data?.months;
        const loadedPlannedLeave = payload.data?.plannedLeave;

        if (loadedMonths && Object.keys(loadedMonths).length > 0) {
          setMonths((prior) => {
            const normalized: Record<string, MonthTimesheetState> = {};

            for (const [monthKey, monthState] of Object.entries(loadedMonths)) {
              normalized[monthKey] = normalizeMonthState(monthKey, monthState, ruleSettings, currentDateIso);
            }

            return { ...prior, ...normalized };
          });
        }

        if (Array.isArray(loadedPlannedLeave)) {
          setPlannedLeave(loadedPlannedLeave);
        }

        setSqliteSync({ state: "ready", message: "SQLite loaded", lastSavedAt: null });
      } catch (error) {
        if (!cancelled) {
          setSqliteSync({
            state: "error",
            message: `SQLite load failed: ${error instanceof Error ? error.message : "unknown error"}`,
            lastSavedAt: null
          });
        }
      } finally {
        if (!cancelled) {
          setHydratedFromSqlite(true);
        }
      }
    }

    void loadSqliteState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedFromSqlite) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSqliteSync((prior) => ({ ...prior, state: "saving", message: "Saving to SQLite..." }));

        const response = await fetch(`${API_BASE_URL}/v1/sqlite/state`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            months,
            plannedLeave
          })
        });

        if (!response.ok) {
          throw new Error(`Save failed with status ${response.status}`);
        }

        setSqliteSync({ state: "ready", message: "Saved to SQLite", lastSavedAt: nowIso() });
      } catch (error) {
        setSqliteSync((prior) => ({
          ...prior,
          state: "error",
          message: `SQLite save failed: ${error instanceof Error ? error.message : "unknown error"}`
        }));
      }
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [hydratedFromSqlite, months, plannedLeave]);

  const selectedYear = Number(selectedMonth.slice(0, 4));

  const leaveSummary = useMemo(() => {
    const takenHours = Object.values(months)
      .flatMap((monthState) => monthState.dayEntries)
      .filter((entry) => entry.date.startsWith(`${selectedYear}-`) && entry.absenceCode === "AL")
      .reduce((sum) => sum + ruleSettings.leavePaidMinutesDefault / 60, 0);

    const plannedHours = plannedLeave
      .filter((record) => record.date.startsWith(`${selectedYear}-`))
      .reduce((sum, record) => sum + record.hours, 0);

    const remainingAfterTaken = ANNUAL_LEAVE_ENTITLEMENT_HOURS - takenHours;
    const remainingAfterPlanned = remainingAfterTaken - plannedHours;

    return {
      year: selectedYear,
      entitlementHours: ANNUAL_LEAVE_ENTITLEMENT_HOURS,
      takenHours,
      plannedHours,
      remainingAfterTaken,
      remainingAfterPlanned
    };
  }, [months, plannedLeave, ruleSettings.leavePaidMinutesDefault, selectedYear]);

  const value: AppStateValue = {
    role,
    setRole,
    selectedMonth,
    setSelectedMonth,
    currentDateIso,
    periodLabel: selectedMonth,
    periodDisplayLabel: monthLabel(selectedMonth),
    status: currentMonthData.status,
    revisionNo: currentMonthData.revisionNo,
    ruleSettings,
    dayEntries: currentMonthData.dayEntries,
    approvals: currentMonthData.approvals,
    exportBatches: currentMonthData.exportBatches,
    managerNote: currentMonthData.managerNote,
    setManagerNote,
    employeeSignature: currentMonthData.employeeSignature,
    managerSignature: currentMonthData.managerSignature,
    computed,
    sqliteSync,
    updateDayEntry,
    addProjectLine,
    updateProjectLine,
    removeProjectLine,
    signAsEmployee,
    signAsManager,
    submitTimesheet,
    managerApprove,
    managerReject,
    payrollValidate,
    lockPeriod,
    createExportBatch,
    updateRuleSettings,
    annualLeaveEntitlementHours: ANNUAL_LEAVE_ENTITLEMENT_HOURS,
    plannedLeave,
    addPlannedLeave,
    removePlannedLeave,
    leaveSummary
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return context;
}
