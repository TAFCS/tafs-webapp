/**
 * Bulk voucher job report: result types, filtering and the CSV export.
 *
 * TAFSD-547 added HELD_BACK_ARREARS: a job started with "Hold back students
 * with arrears" issues nothing to a student whose arrears
 * (VouchersService.computeArrears) are above zero, and reports them with the
 * amount, months behind and oldest unpaid fee date, so they can be issued later
 * from "Generate for held-back students".
 */

export type JobResultType = "SUCCESS" | "HELD_BACK_ARREARS" | "SKIPPED" | "FAILED";

export const HELD_BACK_ARREARS: JobResultType = "HELD_BACK_ARREARS";

export const RESULT_TYPE_OPTIONS: { id: JobResultType; label: string }[] = [
    { id: "SUCCESS", label: "Issued" },
    { id: "HELD_BACK_ARREARS", label: "Held back (arrears)" },
    { id: "SKIPPED", label: "Skipped" },
    { id: "FAILED", label: "Failed" },
];

/** One row of `bulk_voucher_jobs.report`. Older rows carry only cc / name / status. */
export interface JobReportRow {
    cc?: number;
    student_name?: string;
    status?: string;
    reason?: string;
    error?: string;
    voucher_id?: number;
    pdf_url?: string;
    partially_paid?: boolean;
    split_from_partially_paid?: boolean;
    // HELD_BACK_ARREARS only
    arrears_amount?: number;
    arrears_months?: number;
    oldest_unpaid_fee_date?: string | null;
    arrears_as_of?: string;
    class_name?: string | null;
    section_name?: string | null;
    campus_name?: string | null;
    items_held?: number;
}

/** The URL query param the result-type filter round-trips through. */
export const RESULT_FILTER_PARAM = "result";

export function parseResultFilter(search: string): JobResultType[] {
    const raw = new URLSearchParams(search).get(RESULT_FILTER_PARAM);
    if (!raw) return [];
    const known = new Set(RESULT_TYPE_OPTIONS.map((o) => o.id));
    return raw.split(",").filter((v): v is JobResultType => known.has(v as JobResultType));
}

/** Rows that are a student outcome (the report also carries an INTERRUPTED note). */
export function isStudentRow(r: JobReportRow): boolean {
    return r.status === "SUCCESS" || r.status === "SKIPPED" || r.status === "FAILED" || r.status === HELD_BACK_ARREARS;
}

/** Empty filter means every result type. */
export function matchesResultFilter(r: JobReportRow, filter: JobResultType[]): boolean {
    return filter.length === 0 || filter.includes(r.status as JobResultType);
}

export function matchesSearch(r: JobReportRow, q: string): boolean {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (r.student_name ?? "").toLowerCase().includes(s) || String(r.cc ?? "").includes(s);
}

export function heldBackRows(report: JobReportRow[] | null | undefined): JobReportRow[] {
    return (report ?? []).filter((r) => r.status === HELD_BACK_ARREARS);
}

export function formatRs(n: number | null | undefined): string {
    return n == null ? "" : `Rs ${Number(n).toLocaleString("en-US")}`;
}

export function classSection(r: JobReportRow): string {
    return [r.class_name, r.section_name].filter(Boolean).join(" - ");
}

function csvCell(v: unknown): string {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

/**
 * The job report as CSV, with the held-back columns next to the existing ones.
 * `label` / `note` are the page's friendly wording for each row.
 */
export function downloadJobReportCsv(
    jobId: number | string,
    rows: JobReportRow[],
    label: (r: JobReportRow) => string,
    note: (r: JobReportRow) => string,
) {
    const headers = [
        "Student Name",
        "CC",
        "Status",
        "Notes",
        "Class / Section",
        "Campus",
        "Arrears (Rs)",
        "Months Behind",
        "Oldest Unpaid Fee Date",
    ];
    const lines = rows.map((r) => [
        r.student_name ?? "",
        r.cc ?? "",
        label(r),
        note(r),
        classSection(r),
        r.campus_name ?? "",
        r.status === HELD_BACK_ARREARS ? (r.arrears_amount ?? "") : "",
        r.status === HELD_BACK_ARREARS ? (r.arrears_months ?? "") : "",
        r.status === HELD_BACK_ARREARS ? (r.oldest_unpaid_fee_date ?? "") : "",
    ]);
    const csv = [headers, ...lines].map((line) => line.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voucher-job-${jobId}-report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
