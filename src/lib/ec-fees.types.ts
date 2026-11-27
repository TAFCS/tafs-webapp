/**
 * TAFSD-605: Extracurricular Fees. Shapes returned by the /v1/ec-* endpoints.
 * Every amount is whole rupees; every rule lives on the backend.
 */

export type EcFeeFrequency = "MONTHLY" | "ONE_TIME";
export type EcFeeHeadState = "ACTIVE" | "INACTIVE";

export const EC_FREQUENCY_LABEL: Record<EcFeeFrequency, string> = {
    MONTHLY: "Monthly",
    ONE_TIME: "One-time",
};

export interface EcFeeHead {
    id: number;
    name: string;
    frequency: EcFeeFrequency;
    /** Calendar months 1-12, in school-year order (Aug first). */
    months: number[];
    sort_order: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    charges_count: number;
    schedule_rows_count: number;
}

export interface EcFeeHeadOption {
    id: number;
    name: string;
    frequency: EcFeeFrequency;
    months: number[];
    sort_order: number;
}

export interface EcFeeHeadSearchHit {
    id: number;
    name: string;
    frequency: EcFeeFrequency;
    is_active: boolean;
}

export interface EcFeeHeadListQuery {
    q?: string;
    frequencies?: EcFeeFrequency[];
    states?: EcFeeHeadState[];
}

export interface EcFeeHeadInput {
    name: string;
    frequency: EcFeeFrequency;
    months: number[];
    sort_order?: number;
}

export interface EcFeeHeadPatch extends Partial<EcFeeHeadInput> {
    is_active?: boolean;
}

export interface EcClassScheduleRow {
    id: number;
    class_id: number;
    class_name: string;
    fee_head_id: number;
    fee_head_name: string;
    /** null = every campus. */
    campus_id: number | null;
    campus_name: string | null;
    academic_year: string;
    amount: number;
    updated_by: string | null;
    updated_at: string;
}

export interface EcClassScheduleQuery {
    academic_year: string;
    campus_ids?: number[];
    class_ids?: number[];
    fee_head_ids?: number[];
}

export interface EcClassScheduleCell {
    class_id: number;
    fee_head_id: number;
    campus_id: number | null;
    /** Whole rupees; null clears the cell. */
    amount: number | null;
}

/** School-year order, Aug first: the order EC months are stored and shown in. */
export const EC_MONTHS: { num: number; short: string; long: string }[] = [
    { num: 8, short: "Aug", long: "August" },
    { num: 9, short: "Sep", long: "September" },
    { num: 10, short: "Oct", long: "October" },
    { num: 11, short: "Nov", long: "November" },
    { num: 12, short: "Dec", long: "December" },
    { num: 1, short: "Jan", long: "January" },
    { num: 2, short: "Feb", long: "February" },
    { num: 3, short: "Mar", long: "March" },
    { num: 4, short: "Apr", long: "April" },
    { num: 5, short: "May", long: "May" },
    { num: 6, short: "Jun", long: "June" },
    { num: 7, short: "Jul", long: "July" },
];

export const ecMonthShort = (m: number) => EC_MONTHS.find((x) => x.num === m)?.short ?? String(m);

/** "Rs. 1,500" */
export const ecRs = (v: number | null | undefined) =>
    v == null ? "—" : `Rs. ${Math.round(v).toLocaleString("en-PK")}`;

/** The backend's message, or a fallback. */
export const ecErrMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};
