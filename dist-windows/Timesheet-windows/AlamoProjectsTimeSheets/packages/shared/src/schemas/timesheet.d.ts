import { z } from "zod";
export declare const upsertDayEntrySchema: z.ZodEffects<z.ZodObject<{
    workDate: z.ZodString;
    lineNo: z.ZodDefault<z.ZodNumber>;
    startLocal: z.ZodNullable<z.ZodString>;
    endLocal: z.ZodNullable<z.ZodString>;
    breakMinutes: z.ZodDefault<z.ZodNumber>;
    absenceCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    workDate: string;
    lineNo: number;
    startLocal: string | null;
    endLocal: string | null;
    breakMinutes: number;
    absenceCode: string | null;
    notes: string | null;
}, {
    workDate: string;
    startLocal: string | null;
    endLocal: string | null;
    lineNo?: number | undefined;
    breakMinutes?: number | undefined;
    absenceCode?: string | null | undefined;
    notes?: string | null | undefined;
}>, {
    workDate: string;
    lineNo: number;
    startLocal: string | null;
    endLocal: string | null;
    breakMinutes: number;
    absenceCode: string | null;
    notes: string | null;
}, {
    workDate: string;
    startLocal: string | null;
    endLocal: string | null;
    lineNo?: number | undefined;
    breakMinutes?: number | undefined;
    absenceCode?: string | null | undefined;
    notes?: string | null | undefined;
}>;
export type UpsertDayEntryInput = z.infer<typeof upsertDayEntrySchema>;
