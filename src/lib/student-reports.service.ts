import api from "@/lib/api";
import { STUDENT_BENEFITS, type StudentBenefitKey } from "@/lib/student-benefits";

// TAFSD-451: Student Reports. Strength counts students on roll in rows of
// campus → class → section and columns of one split, or two crossed.

export const STRENGTH_SPLITS = [
    { id: "gender", label: "Gender" },
    { id: "house", label: "House" },
    { id: "status", label: "Status" },
    { id: "age", label: "Age" },
    { id: "new_returning", label: "New / returning" },
    { id: "discipline", label: "Discipline" },
    { id: "segment", label: "Segment" },
] as const;

// TAFSD-452: Special Categories adds these splits ahead of the Strength ones. Full words only, never FE or Comp.
export const CATEGORY_SPLITS = [
    { id: "siblings", label: "Siblings" },
    { id: "category", label: "Special category" },
] as const;
export const ALL_SPLITS = [...CATEGORY_SPLITS, ...STRENGTH_SPLITS] as const;
export type StrengthSplit = (typeof ALL_SPLITS)[number]["id"];

export const SIBLING_OPTIONS = [
    { id: "LINKED", label: "Has siblings" },
    { id: "SINGLE", label: "No siblings" },
] as const;

// TAFSD-455: every benefit category, then Neither.
export const CATEGORY_OPTIONS = [
    ...STUDENT_BENEFITS.map((b) => ({ id: b.key as string, label: b.label })),
    { id: "NONE", label: "Neither" },
];

/** TAFSD-455: keep only students whose benefit ends within this many days. */
export const ENDING_OPTIONS = [
    { id: "", label: "Any end date" },
    { id: "30", label: "Ending within 30 days" },
    { id: "60", label: "Ending within 60 days" },
    { id: "90", label: "Ending within 90 days" },
    { id: "180", label: "Ending within 6 months" },
    { id: "365", label: "Ending within a year" },
] as const;

export type StudentReport = "strength" | "categories";

export const STRENGTH_ROW_LEVELS = [
    { id: "campus", label: "Campus" },
    { id: "class", label: "Class" },
    { id: "section", label: "Section" },
] as const;
export type StrengthRowLevel = (typeof STRENGTH_ROW_LEVELS)[number]["id"];

export const STRENGTH_GENDERS = [
    { id: "MALE", label: "Male" },
    { id: "FEMALE", label: "Female" },
    { id: "UNKNOWN", label: "Not set" },
] as const;

export interface StrengthFilters {
    campus_id: number[];
    class_id: number[];
    section_id: number[];
    house_id: number[];
    status: string[];
    gender: string[];
    siblings: string[];
    category: string[];
    /** TAFSD-455: "" = any end date. */
    ending_within_days: string;
    rows: StrengthRowLevel;
    split: StrengthSplit | "";
    split2: StrengthSplit | "";
}

export interface StrengthColumn {
    key: string;
    label: string;
    group?: string;
    subtotal?: boolean;
}

export interface StrengthRow {
    key: string;
    level: StrengthRowLevel;
    campus_id: number | null;
    class_id: number | null;
    section_id: number | null;
    label: string;
    campus: string;
    counts: Record<string, number>;
    total: number;
}

export interface StrengthGrid {
    columns: StrengthColumn[];
    rows: StrengthRow[];
    totals: { counts: Record<string, number>; total: number };
    student_count: number;
    as_of: string;
    session_start: string;
}

export interface StrengthCellStudent {
    cc: number;
    full_name: string | null;
    gr_number: string | null;
    campus: string | null;
    class_name: string | null;
    section: string | null;
    house: string | null;
    gender: string;
    status: string;
    age: string;
    // TAFSD-452
    siblings: SiblingRef[];
    other_siblings: SiblingRef[];
    /** TAFSD-455: every benefit switched on; active = false once its end date has passed. */
    benefits: Array<{
        key: StudentBenefitKey;
        label: string;
        reason: string | null;
        until: string | null;
        remind_from: string | null;
        active: boolean;
    }>;
}

export interface SiblingRef {
    cc: number;
    full_name: string | null;
    status: string;
    class_name: string | null;
    section: string | null;
    campus: string | null;
}

/** Query params as the API reads them: arrays comma-joined, empty values dropped. */
export function strengthParams(f: StrengthFilters): Record<string, string> {
    const out: Record<string, string> = { rows: f.rows };
    const list = (key: keyof StrengthFilters, v: Array<string | number>) => {
        if (v.length) out[key] = v.join(",");
    };
    list("campus_id", f.campus_id);
    list("class_id", f.class_id);
    list("section_id", f.section_id);
    list("house_id", f.house_id);
    list("status", f.status);
    list("gender", f.gender);
    list("siblings", f.siblings);
    list("category", f.category);
    if (f.ending_within_days) out.ending_within_days = f.ending_within_days;
    if (f.split) out.split = f.split;
    if (f.split && f.split2 && f.split2 !== f.split) out.split2 = f.split2;
    return out;
}

export const REPORT_EXPORTS: Record<StudentReport, { path: string; basename: string }> = {
    strength: { path: "/v1/student-reports/strength/export", basename: "student-strength" },
    categories: { path: "/v1/student-reports/categories/export", basename: "special-categories" },
};

/** TAFSD-456: Report B downloads one part per file. */
export const CATEGORY_EXPORT_PARTS = [
    { value: "summary", label: "Summary (counts)", file: "summary" },
    { value: "list", label: "Student list", file: "students" },
    { value: "linked", label: "Students with siblings", file: "linked-siblings" },
    { value: "single", label: "Single children", file: "single-children" },
] as const;
export type CategoryExportPart = (typeof CATEGORY_EXPORT_PARTS)[number]["value"];

/** TAFSD-453: Admissions and Withdrawals (report C). */
export type MovementMeasure = "both" | "admissions" | "withdrawals";
export type MovementDeparture = "LEFT" | "EXPELLED" | "GRADUATED";
export interface MovementFilters {
    campus_id: number[];
    class_id: number[];
    measure: MovementMeasure;
    rows: "campus" | "class";
    period: "month" | "session";
    /** YYYY-MM-DD */
    from: string;
    to: string;
    departures: MovementDeparture[];
}
export type MovementGrid = StrengthGrid & { total_label: string; notes: string[] };
export interface MovementCellStudent {
    type: "ADMITTED" | MovementDeparture;
    type_label: string;
    date: string;
    cc: number;
    full_name: string | null;
    gr_number: string | null;
    campus: string | null;
    class_name: string | null;
    section: string | null;
    status: string;
    note: string | null;
}

export function movementParams(f: MovementFilters): Record<string, string> {
    const p: Record<string, string> = { measure: f.measure, rows: f.rows, period: f.period, from: f.from, to: f.to };
    if (f.campus_id.length) p.campus_id = f.campus_id.join(",");
    if (f.class_id.length) p.class_id = f.class_id.join(",");
    if (f.measure !== "admissions" && f.departures.length) p.departures = f.departures.join(",");
    return p;
}

export const movementService = {
    async grid(f: MovementFilters): Promise<MovementGrid> {
        const { data } = await api.get("/v1/student-reports/movement", { params: movementParams(f) });
        return data.data;
    },
    async cellStudents(
        f: MovementFilters,
        cell: { row?: string; column?: string },
    ): Promise<{ total: number; truncated: boolean; items: MovementCellStudent[] }> {
        const { data } = await api.get("/v1/student-reports/movement/students", {
            params: { ...movementParams(f), ...(cell.row ? { row: cell.row } : {}), ...(cell.column ? { column: cell.column } : {}) },
        });
        return data.data;
    },
};

export const studentReportsService = {
    async strength(f: StrengthFilters): Promise<StrengthGrid> {
        const { data } = await api.get("/v1/student-reports/strength", { params: strengthParams(f) });
        return data.data;
    },

    async cellStudents(
        f: StrengthFilters,
        cell: { row?: string; column?: string },
    ): Promise<{ total: number; truncated: boolean; items: StrengthCellStudent[] }> {
        const { data } = await api.get("/v1/student-reports/strength/students", {
            params: { ...strengthParams(f), ...(cell.row ? { row: cell.row } : {}), ...(cell.column ? { column: cell.column } : {}) },
        });
        return data.data;
    },
};
