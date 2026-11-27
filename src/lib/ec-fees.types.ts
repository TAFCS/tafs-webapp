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

// ── Student charges ────────────────────────────────────────────────────────

export type EcChargeStatus = "NOT_ISSUED" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "WAIVED";
export type EcChargeLockReason = "ON_VOUCHER" | "PAID" | "WAIVED";
export type EcAmountSource = "SCHEDULE" | "CUSTOM";

export const EC_CHARGE_STATUS_LABEL: Record<EcChargeStatus, string> = {
    NOT_ISSUED: "Not issued",
    ISSUED: "On a voucher",
    PARTIALLY_PAID: "Part-paid",
    PAID: "Paid",
    WAIVED: "Waived",
};

export interface EcStudentSummary {
    cc: number;
    full_name: string | null;
    gr_number: string | null;
    status: string;
    campus_id: number | null;
    campus_name: string | null;
    class_id: number | null;
    class_name: string | null;
    section_id: number | null;
    section_name: string | null;
}

export interface EcCharge {
    id: number;
    fee_head_id: number;
    fee_head_name: string;
    frequency: EcFeeFrequency;
    academic_year: string;
    target_month: number;
    /** YYYY-MM-DD, the 1st of the month. */
    period: string;
    period_label: string;
    amount: number;
    amount_paid: number;
    waived_amount: number;
    balance: number;
    status: EcChargeStatus;
    source: EcAmountSource;
    remarks: string | null;
    locked_reason: EcChargeLockReason | null;
    current_voucher: { id: number; voucher_number: string | null } | null;
    created_by: string | null;
    created_at: string;
}

export interface EcStudentCharges {
    student: EcStudentSummary;
    charges: EcCharge[];
}

export interface EcStudentClassAmount {
    fee_head_id: number;
    name: string;
    frequency: EcFeeFrequency;
    months: number[];
    /** null: this head has no class amount for the student's class. */
    amount: number | null;
}

export interface EcChargeCell {
    fee_head_id: number;
    target_month: number;
    /** Whole rupees; null removes the charge. */
    amount: number | null;
    source?: EcAmountSource;
}

export interface EcBulkTarget {
    student_ids?: number[];
    campus_ids?: number[];
    class_ids?: number[];
    section_ids?: number[];
}

export interface EcBulkAssignInput extends EcBulkTarget {
    fee_head_id: number;
    academic_year: string;
    months?: number[];
    amount_source: EcAmountSource;
    amount?: number;
}

export interface EcBulkRemoveInput extends EcBulkTarget {
    fee_head_id: number;
    academic_year: string;
    months?: number[];
}

export type EcAssignSkipReason = "ALREADY_CHARGED" | "NO_CLASS_AMOUNT" | "NO_CLASS";

export interface EcBulkAssignPreview {
    head: { id: number; name: string; frequency: EcFeeFrequency };
    academic_year: string;
    months: number[];
    students_matched: number;
    students_requested: number | null;
    students_to_charge: number;
    charges_to_create: number;
    total_amount: number;
    skipped: { already_charged: number; no_class_amount: number; no_class: number };
    rows: {
        cc: number;
        full_name: string | null;
        gr_number: string | null;
        campus_name: string | null;
        class_name: string | null;
        section_name: string | null;
        amount: number | null;
        months_to_create: number[];
        skip_reason: EcAssignSkipReason | null;
    }[];
    rows_truncated: boolean;
    created?: number;
}

export interface EcBulkRemovePreview {
    head: { id: number; name: string; frequency: EcFeeFrequency };
    academic_year: string;
    months: number[] | null;
    students_matched: number;
    charges_to_remove: number;
    amount_to_remove: number;
    locked: number;
    locked_by_reason: Record<EcChargeLockReason, number>;
    rows: {
        cc: number;
        full_name: string | null;
        gr_number: string | null;
        class_name: string | null;
        section_name: string | null;
        removable: string[];
        locked: { period: string; reason: EcChargeLockReason; voucher_number: string | null }[];
    }[];
    rows_truncated: boolean;
    removed?: number;
}

export const EC_SKIP_REASON_LABEL: Record<EcAssignSkipReason, string> = {
    ALREADY_CHARGED: "Already charged for these months",
    NO_CLASS_AMOUNT: "No class amount for their class",
    NO_CLASS: "Not placed in a class",
};

export const EC_LOCK_REASON_LABEL: Record<EcChargeLockReason, string> = {
    ON_VOUCHER: "on a voucher",
    PAID: "paid",
    WAIVED: "waived",
};

// ── Vouchers ───────────────────────────────────────────────────────────────

/** Stored: UNPAID, PARTIALLY_PAID, PAID, WAIVED. Derived when read: EXPIRED, REISSUED. */
export type EcVoucherState = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "WAIVED" | "EXPIRED" | "REISSUED";
export const EC_VOUCHER_STATES: EcVoucherState[] = ["UNPAID", "PARTIALLY_PAID", "PAID", "WAIVED", "EXPIRED", "REISSUED"];

export const EC_VOUCHER_STATE_LABEL: Record<EcVoucherState, string> = {
    UNPAID: "Unpaid",
    PARTIALLY_PAID: "Partially paid",
    PAID: "Paid",
    WAIVED: "Waived",
    EXPIRED: "Expired",
    REISSUED: "Reissued",
};

export interface EcVoucherRef {
    id: number;
    voucher_number: string | null;
}

export interface EcVoucherListItem {
    id: number;
    voucher_number: string | null;
    state: EcVoucherState;
    status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "WAIVED";
    student: { cc: number; full_name: string | null; gr_number: string | null };
    campus_id: number;
    campus_name: string;
    class_id: number;
    class_name: string;
    section_id: number | null;
    section_name: string | null;
    academic_year: string;
    issue_date: string;
    expiry_date: string;
    total_amount: number;
    amount_paid: number;
    amount_waived: number;
    balance: number;
    deposits_count: number;
    lines_count: number;
    reissued_to: EcVoucherRef | null;
    reissued_from: EcVoucherRef | null;
    bulk_run_id: string | null;
    waived_at: string | null;
    waived_by: string | null;
    waive_reason: string | null;
    generated_by_name: string | null;
    created_at: string;
}

export interface EcVoucherLine {
    id: number;
    charge_id: number;
    fee_head_id: number;
    fee_head_name: string;
    period: string;
    period_label: string;
    description: string;
    amount: number;
    amount_paid: number;
    waived_amount: number;
    remaining: number;
}

export interface EcDeposit {
    id: number;
    amount: number;
    deposit_date: string;
    payment_method: string;
    reference_number: string | null;
    bank_name: string | null;
    remarks: string | null;
    recorded_by_name: string | null;
    created_at: string;
    is_latest: boolean;
    allocations: { line_id: number; amount: number }[];
}

export interface EcVoucherDetail extends EcVoucherListItem {
    bank: { id: number; name: string; title: string; account: string; iban: string; address: string } | null;
    has_pdf: boolean;
    lines: EcVoucherLine[];
    deposits: EcDeposit[];
}

export interface EcVoucherFilters {
    q?: string;
    campus_ids?: number[];
    class_ids?: number[];
    section_ids?: number[];
    fee_head_ids?: number[];
    states?: EcVoucherState[];
    academic_years?: string[];
    issue_from?: string;
    issue_to?: string;
    expiry_from?: string;
    expiry_to?: string;
    student_id?: number;
    bulk_run_id?: string;
}

export interface EcVoucherList {
    items: EcVoucherListItem[];
    meta: { page: number; limit: number; total: number; pages: number };
    summary: { count: number; total_amount: number; amount_paid: number; amount_waived: number; balance: number };
}

export interface EcVoucherSearchHit {
    id: number;
    voucher_number: string | null;
    student_id: number;
    full_name: string | null;
    gr_number: string | null;
    class_name: string;
    state: EcVoucherState;
    expiry_date: string;
    balance: number;
}

export interface EcIssuableCharge {
    id: number;
    fee_head_id: number;
    fee_head_name: string;
    academic_year: string;
    target_month: number;
    period: string;
    period_label: string;
    amount: number;
}

export interface EcIssuable {
    student: EcStudentSummary;
    charges: EcIssuableCharge[];
    open_vouchers: EcVoucherListItem[];
    default_validity_days: number;
}

export interface EcStudentVouchers {
    student: Omit<EcStudentSummary, "campus_id" | "class_id" | "section_id">;
    vouchers: EcVoucherDetail[];
    unissued_charges: EcIssuableCharge[];
    stats: { billed: number; received: number; waived: number; open_balance: number; lapsed_balance: number; unissued: number };
}

export interface EcDepositInput {
    voucher_id: number;
    /** Whole rupees, at most the voucher balance. */
    amount: number;
    allocation: "AUTO" | "MANUAL";
    lines?: { line_id: number; amount: number }[];
    payment_method: string;
    /** YYYY-MM-DD, the day it was paid (bank stamp). */
    deposit_date?: string;
    reference_number?: string;
    bank_name?: string;
    remarks?: string;
}

export interface EcBulkIssueFilters extends EcBulkTarget {
    fee_head_ids?: number[];
    months?: number[];
    academic_years?: string[];
}

export interface EcBulkIssuePreview {
    students_matched: number;
    students_requested: number | null;
    students_with_charges: number;
    students_without_charges: number;
    vouchers_to_issue: number;
    total_amount: number;
    eligible_student_ids: number[];
    rows: {
        cc: number;
        full_name: string | null;
        gr_number: string | null;
        campus_name: string | null;
        class_name: string | null;
        section_name: string | null;
        academic_year: string;
        charges: number;
        total: number;
        description: string;
    }[];
    rows_truncated: boolean;
}

export type EcBulkIssueResult =
    | { cc: number; status: "ISSUED"; voucher_id: number; voucher_number: string; academic_year: string; total: number }
    | { cc: number; status: "SKIPPED" | "FAILED"; reason: string; academic_year?: string };

export interface EcBulkIssueChunk {
    run_id: string;
    issued: number;
    skipped: number;
    failed: number;
    results: EcBulkIssueResult[];
}

export interface EcPdfLink {
    url: string;
    filename: string;
}

/** YYYY-MM-DD → "27 Nov 2026" */
export const ecDate = (d: string | null | undefined) =>
    d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

/** Today in Pakistan, YYYY-MM-DD (the date every EC rule uses). */
export const ecTodayKey = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const ecAddDays = (key: string, days: number) =>
    new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

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
