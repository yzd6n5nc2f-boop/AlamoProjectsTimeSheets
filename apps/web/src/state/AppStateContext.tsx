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
  getTodayIso,
  monthLabel,
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

export interface PlannedLeaveRecord {
  id: string;
  date: string;
  hours: number;
  note: string;
}

interface MonthTimesheetState {
  status: WorkflowStatus;
  revisionNo: number;
  dayEntries: DayEntry[];
  approvals: ApprovalEvent[];
  exportBatches: ExportBatch[];
  managerNote: string;
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
  computed: ReturnType<typeof calculateTimesheet>;
  updateDayEntry: (date: string, patch: Partial<DayEntry>) => void;
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

function buildMonthEntries(monthKey: string, settings: RuleSettings, todayIso: string): DayEntry[] {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const totalDays = daysInMonth(monthKey);

  const entries: DayEntry[] = [];

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayType = resolveDayType(date, settings);
    const isPastOrCurrent = date <= todayIso;

    if (dayType === "PUBLIC_HOLIDAY") {
      entries.push({
        date,
        dayType,
        projectDescription: "",
        hoursWorked: 0,
        absenceCode: "PH",
        notes: "Public holiday"
      });
      continue;
    }

    if (!isPastOrCurrent || dayType === "WEEKEND") {
      entries.push({
        date,
        dayType,
        projectDescription: "",
        hoursWorked: 0,
        absenceCode: "",
        notes: ""
      });
      continue;
    }

    entries.push({
      date,
      dayType,
      projectDescription: "General Project Work",
      hoursWorked: dayType === "FRIDAY_SHORT_DAY" ? 6 : 8,
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
    managerNote: ""
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

  const [months, setMonths] = useState<Record<string, MonthTimesheetState>>(() => {
    const month = currentMonthKey();
    return {
      [month]: buildMonthState(month, INITIAL_RULES, getTodayIso())
    };
  });

  const [plannedLeave, setPlannedLeave] = useState<PlannedLeaveRecord[]>([
    {
      id: "PL-2026-03-04",
      date: "2026-03-04",
      hours: 8,
      note: "Planned annual leave"
    }
  ]);

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
            next.hoursWorked = 0;
          }

          if (Object.prototype.hasOwnProperty.call(patch, "hoursWorked") && (patch.hoursWorked ?? 0) > 0) {
            next.absenceCode = "";
          }

          next.dayType = resolveDayType(next.date, ruleSettings);
          return next;
        })
      }));
    },
    [currentMonthData.status, ruleSettings, updateCurrentMonth]
  );

  const submitTimesheet = useCallback(() => {
    if (!(currentMonthData.status === "DRAFT" || currentMonthData.status === "MANAGER_REJECTED")) {
      return { ok: false, message: "Only Draft or Rejected timesheets can be submitted." };
    }

    if (computed.hasBlockingErrors) {
      return { ok: false, message: "Fix validation errors before submit." };
    }

    updateCurrentMonth((monthState) => ({
      ...monthState,
      status: "SUBMITTED",
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
  }, [computed.hasBlockingErrors, currentMonthData.status, selectedMonth, updateCurrentMonth]);

  const managerApprove = useCallback(() => {
    if (currentMonthData.status !== "SUBMITTED") {
      return { ok: false, message: "Manager can approve only submitted timesheets." };
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
  }, [computed.requiresManagerApproval, currentMonthData.managerNote, currentMonthData.status, updateCurrentMonth]);

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
  }, [currentMonthData.status, updateCurrentMonth]);

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
        projectDescription: entry.projectDescription,
        hoursWorked: entry.hoursWorked,
        absenceCode: entry.absenceCode
      }))
    });

    const checksum = hashForBatch(signature);

    updateCurrentMonth((monthState) => ({
      ...monthState,
      exportBatches: [
        {
          batchId,
          createdAt: nowIso(),
          lineCount: monthState.dayEntries.filter((entry) => entry.hoursWorked > 0 || entry.absenceCode.length > 0).length,
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
  }, [computed.periodTotals, currentMonthData.dayEntries, currentMonthData.revisionNo, currentMonthData.status, selectedMonth, updateCurrentMonth]);

  const updateRuleSettings = useCallback(
    (patch: Partial<RuleSettings>) => {
      setRuleSettings((prior) => {
        const next = { ...prior, ...patch };

        setMonths((existingMonths) => {
          const updated: Record<string, MonthTimesheetState> = {};

          for (const [monthKey, monthState] of Object.entries(existingMonths)) {
            updated[monthKey] = {
              ...monthState,
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
      updateCurrentMonth((monthState) => ({ ...monthState, managerNote: value }));
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
    computed,
    updateDayEntry,
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
