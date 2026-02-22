import { z } from "zod";
export const upsertDayEntrySchema = z
    .object({
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lineNo: z.number().int().positive().default(1),
    startLocal: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    endLocal: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    breakMinutes: z.number().int().min(0).default(0),
    absenceCode: z.string().min(1).max(16).nullable().default(null),
    notes: z.string().max(500).nullable().default(null)
})
    .superRefine((value, ctx) => {
    const hasStart = value.startLocal !== null;
    const hasEnd = value.endLocal !== null;
    if (value.absenceCode && (hasStart || hasEnd)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["absenceCode"],
            message: "Absence code cannot be combined with start/finish time."
        });
    }
    if (hasStart !== hasEnd) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["startLocal"],
            message: "Start and finish must both be set or both be blank."
        });
    }
    if (hasStart && hasEnd && value.endLocal <= value.startLocal) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endLocal"],
            message: "Finish time must be after start time."
        });
    }
});
//# sourceMappingURL=timesheet.js.map