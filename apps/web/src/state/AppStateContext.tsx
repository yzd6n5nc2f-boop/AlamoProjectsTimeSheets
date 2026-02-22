import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import {
  calculateTimesheet,
  resolveDayType,
  type DayEntry,
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

interface AppStateValue {
  role: AppRole;
  setRole: (role: AppRole) => void;
  status: WorkflowStatus;
  periodLabel: string;
  revisionNo: number;
  ruleSettings: RuleSettings;
  dayEntries: DayEntry[];
  approvals: ApprovalEvent[];
  exportBatches: ExportBatch[];
  managerNote: string;
  setManagerNote: (value: string) => void;
  computed: ReturnType<typeof calculateTimesheet>;
  updateDayEntry: (date: string, patch: Partial<DayEntry>) => void;
  submitTimesheet: () => { ok: boolean; message: string };
  managerApprove: () => { ok: boolean; message: string };
  managerReject: () => { ok: boolean; message: string };
  payrollValidate: () => { ok: boolean; message: string };
  lockPeriod: () => { ok: boolean; message: string };
  createExportBatch: () => { ok: boolean; message: string };
  updateRuleSettings: (patch: Partial<RuleSettings>) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const PERIOD_DAYS = [
  "2026-02-02",
  "2026-02-03",
  "2026-02-04",
  "2026-02-05",
  "2026-02-06",
  "2026-02-09",
  "2026-02-10",
  "2026-02-11",
  "2026-02-12",
  "2026-02-13"
];

const INITIAL_RULES: RuleSettings = {
  fullDayMinutes: 480,
  leavePaidMinutesDefault: 480,
  fridayShortDayMinutes: 360,
  earlyKnockOffPaidFullDay: true,
  earlyKnockOffDates: ["2026-02-12"],
  publicHolidays: ["2026-02-10"]
};

function buildInitialEntries(settings: RuleSettings): DayEntry[] {
  return PERIOD_DAYS.map((date) => {
    const dayType = resolveDayType(date, settings);

    if (date === "2026-02-10") {
      return {
        date,
        dayType,
        startLocal: "",
        endLocal: "",
        breakMinutes: 0,
        absenceCode: "PH",
        notes: "Public holiday"
      };
    }

    return {
      date,
      dayType,
      startLocal: "08:00",
      endLocal: dayType === "FRIDAY_SHORT_DAY" ? "15:00" : "16:30",
      breakMinutes: 30,
      absenceCode: "",
      notes: ""
    };
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildBatchId(): string {
  const timestamp = Date.now();
  return `TSB-${timestamp}`;
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
  const [status, setStatus] = useState<WorkflowStatus>("DRAFT");
  const [revisionNo, setRevisionNo] = useState(1);
  const [ruleSettings, setRuleSettings] = useState<RuleSettings>(INITIAL_RULES);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>(() => buildInitialEntries(INITIAL_RULES));
  const [managerNote, setManagerNote] = useState("");
  const [approvals, setApprovals] = useState<ApprovalEvent[]>([]);
  const [exportBatches, setExportBatches] = useState<ExportBatch[]>([]);

  const computed = useMemo(() => calculateTimesheet(dayEntries, ruleSettings), [dayEntries, ruleSettings]);

  const updateDayEntry = useCallback(
    (date: string, patch: Partial<DayEntry>) => {
      if (!(status === "DRAFT" || status === "MANAGER_REJECTED")) {
        return;
      }

      setDayEntries((prior) =>
        prior.map((entry) => {
          if (entry.date !== date) {
            return entry;
          }

          const next = { ...entry, ...patch };
          if (Object.prototype.hasOwnProperty.call(patch, "absenceCode") && patch.absenceCode && patch.absenceCode.length > 0) {
            next.startLocal = "";
            next.endLocal = "";
          }

          if (Object.prototype.hasOwnProperty.call(patch, "startLocal") || Object.prototype.hasOwnProperty.call(patch, "endLocal")) {
            if (patch.startLocal || patch.endLocal) {
              next.absenceCode = "";
            }
          }

          next.dayType = resolveDayType(next.date, ruleSettings);
          return next;
        })
      );
    },
    [ruleSettings, status]
  );

  const submitTimesheet = useCallback(() => {
    if (!(status === "DRAFT" || status === "MANAGER_REJECTED")) {
      return { ok: false, message: "Only Draft or Rejected timesheets can be submitted." };
    }
    if (computed.hasBlockingErrors) {
      return { ok: false, message: "Fix validation errors before submit." };
    }

    setStatus("SUBMITTED");
    setApprovals((prior) => [
      ...prior,
      {
        at: nowIso(),
        actor: "Employee",
        action: "SUBMIT",
        note: "Timesheet submitted"
      }
    ]);

    return { ok: true, message: "Timesheet submitted." };
  }, [computed.hasBlockingErrors, status]);

  const managerApprove = useCallback(() => {
    if (status !== "SUBMITTED") {
      return { ok: false, message: "Manager can approve only submitted timesheets." };
    }
    if (computed.requiresManagerApproval && managerNote.trim().length === 0) {
      return { ok: false, message: "Add manager confirmation note for OT/PH approval." };
    }

    setStatus("MANAGER_APPROVED");
    setApprovals((prior) => [
      ...prior,
      {
        at: nowIso(),
        actor: "Manager",
        action: "MANAGER_APPROVE",
        note: managerNote || "Approved"
      }
    ]);

    return { ok: true, message: "Manager approved." };
  }, [computed.requiresManagerApproval, managerNote, status]);

  const managerReject = useCallback(() => {
    if (status !== "SUBMITTED") {
      return { ok: false, message: "Manager can reject only submitted timesheets." };
    }
    if (managerNote.trim().length < 5) {
      return { ok: false, message: "Rejection note is required." };
    }

    setStatus("MANAGER_REJECTED");
    setRevisionNo((current) => current + 1);
    setApprovals((prior) => [
      ...prior,
      {
        at: nowIso(),
        actor: "Manager",
        action: "MANAGER_REJECT",
        note: managerNote
      }
    ]);

    return { ok: true, message: "Manager rejected. Employee can edit and resubmit." };
  }, [managerNote, status]);

  const payrollValidate = useCallback(() => {
    if (status !== "MANAGER_APPROVED") {
      return { ok: false, message: "Payroll validation requires manager approval first." };
    }

    setStatus("PAYROLL_VALIDATED");
    setApprovals((prior) => [
      ...prior,
      {
        at: nowIso(),
        actor: "Payroll",
        action: "PAYROLL_VALIDATE",
        note: "All blocking exceptions resolved"
      }
    ]);

    return { ok: true, message: "Payroll validated." };
  }, [status]);

  const lockPeriod = useCallback(() => {
    if (status !== "PAYROLL_VALIDATED") {
      return { ok: false, message: "Only payroll-validated timesheets can be locked." };
    }

    setStatus("LOCKED");
    setApprovals((prior) => [
      ...prior,
      {
        at: nowIso(),
        actor: "Payroll",
        action: "LOCK",
        note: "Period locked"
      }
    ]);

    return { ok: true, message: "Period locked." };
  }, [status]);

  const createExportBatch = useCallback(() => {
    if (!(status === "PAYROLL_VALIDATED" || status === "LOCKED")) {
      return { ok: false, message: "Export requires payroll validated or locked status." };
    }

    const batchId = buildBatchId();
    const signature = JSON.stringify({
      revisionNo,
      status,
      totals: computed.periodTotals,
      entries: dayEntries.map((entry) => ({
        date: entry.date,
        startLocal: entry.startLocal,
        endLocal: entry.endLocal,
        absenceCode: entry.absenceCode
      }))
    });

    const checksum = hashForBatch(signature);

    setExportBatches((prior) => [
      {
        batchId,
        createdAt: nowIso(),
        lineCount: dayEntries.length,
        checksum
      },
      ...prior
    ]);

    setApprovals((prior) => [
      ...prior,
      {
        at: nowIso(),
        actor: "Payroll",
        action: "EXPORT_BATCH",
        note: `Batch ${batchId}`
      }
    ]);

    return { ok: true, message: `Export batch ${batchId} created.` };
  }, [computed.periodTotals, dayEntries, revisionNo, status]);

  const updateRuleSettings = useCallback((patch: Partial<RuleSettings>) => {
    setRuleSettings((prior) => {
      const next = { ...prior, ...patch };
      setDayEntries((entries) => entries.map((entry) => ({ ...entry, dayType: resolveDayType(entry.date, next) })));
      return next;
    });
  }, []);

  const value: AppStateValue = {
    role,
    setRole,
    status,
    periodLabel: "2026-P02",
    revisionNo,
    ruleSettings,
    dayEntries,
    approvals,
    exportBatches,
    managerNote,
    setManagerNote,
    computed,
    updateDayEntry,
    submitTimesheet,
    managerApprove,
    managerReject,
    payrollValidate,
    lockPeriod,
    createExportBatch,
    updateRuleSettings
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
