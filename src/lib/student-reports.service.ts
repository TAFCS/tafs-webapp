import api from "@/lib/api";

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
export type StrengthSplit = (typeof STRENGTH_SPLITS)[number]["id"];

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
    if (f.split) out.split = f.split;
    if (f.split && f.split2 && f.split2 !== f.split) out.split2 = f.split2;
    return out;
}

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
