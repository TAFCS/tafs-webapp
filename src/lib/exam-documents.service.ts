import api from "./api";

/**
 * TAFSD-510: Student → Exam Documents. Schedules, and admit cards (VI–X) /
 * statements of entry (every other class) issued to students whose dues are
 * cleared through the schedule's fee month. The dues check and every rule are
 * the backend's; this only carries requests.
 */

export type ExamDocType = "ADMIT_CARD" | "STATEMENT_OF_ENTRY";
export type ExamScheduleStatus = "DRAFT" | "PUBLISHED";
export type RosterState = "ISSUED" | "CLEARED" | "NOT_BILLED" | "BLOCKED";
export const ROSTER_STATES: RosterState[] = ["CLEARED", "NOT_BILLED", "BLOCKED", "ISSUED"];
export type MissingData = "photo" | "father" | "dob";
export type FeeDateKind = "SCHEDULE" | "OWN";

export const DOC_TYPE_LABELS: Record<ExamDocType, string> = {
    ADMIT_CARD: "Admit card",
    STATEMENT_OF_ENTRY: "Statement of entry",
};

export const ROSTER_STATE_LABELS: Record<RosterState, string> = {
    CLEARED: "Cleared",
    NOT_BILLED: "Not billed",
    BLOCKED: "Owes dues",
    ISSUED: "Issued",
};

export interface ExamScheduleClass {
    id: number;
    description: string;
    doc_type: ExamDocType;
}

export interface ExamPaper {
    id?: number;
    class_id: number;
    paper_date: string;
    time_text: string;
    subject: string;
    code?: string | null;
}

export interface ExamSchedule {
    id: number;
    campus_id: number;
    campus_name: string;
    academic_year: string;
    title: string;
    segment_line: string | null;
    reference_no: string | null;
    /** Every fee head dated on or before this must be settled. */
    fee_date: string;
    fee_date_label: string;
    students_with_own_fee_date: number;
    issue_from: string | null;
    notes: string[];
    status: ExamScheduleStatus;
    classes: ExamScheduleClass[];
    papers: ExamPaper[];
    documents_issued: number;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

export type ExamScheduleSummary = Omit<ExamSchedule, "papers"> & { paper_count: number };

export interface ExamScheduleUpsert {
    campus_id: number;
    academic_year: string;
    title: string;
    segment_line?: string;
    reference_no?: string;
    fee_date: string;
    issue_from?: string;
    notes: string[];
    class_ids: number[];
    papers: ExamPaper[];
}

export interface ExamDocumentInfo {
    serial: string;
    doc_type: ExamDocType;
    issued_at: string;
    issued_by: string;
    print_count: number;
    last_printed_at: string;
    overridden: boolean;
    override_reason: string | null;
    dues_outstanding_at_issue: number;
    /** The fee date the student was checked against when it was issued. */
    fee_date: string | null;
}

export interface MonthOwed {
    fee_date: string;
    billed: number;
    not_billed: number;
}

export interface OwnFeeDate {
    fee_date: string;
    reason: string | null;
    set_by: string;
    set_at: string;
}

export interface RosterRow {
    cc: number;
    gr_number: string | null;
    full_name: string;
    class_id: number | null;
    class_name: string | null;
    section_id: number | null;
    section_name: string | null;
    student_status: string;
    discipline: string | null;
    has_photo: boolean;
    has_father: boolean;
    has_dob: boolean;
    /** The date this student is checked against: their own, else the schedule's. */
    fee_date: string;
    own_fee_date: OwnFeeDate | null;
    state: RosterState;
    owed: number;
    /** On a voucher, plus surcharges: what the family could pay today. */
    billed_owed: number;
    /** On heads never put on a voucher. */
    not_billed_owed: number;
    surcharge_outstanding: number;
    oldest_unpaid_fee_date: string | null;
    months: MonthOwed[];
    document: ExamDocumentInfo | null;
}

export interface Roster {
    schedule: ExamScheduleSummary;
    fee_date: string;
    issue_window_open: boolean;
    counts: Record<RosterState, number>;
    own_fee_dates: number;
    blocked_owed_total: number;
    not_billed_owed_total: number;
    rows: RosterRow[];
}

export interface RosterQuery {
    class_ids?: number[];
    section_ids?: number[];
    states?: RosterState[];
    q?: string;
    disciplines?: string[];
    has_photo?: "true" | "false" | "";
    missing?: MissingData[];
    fee_date_kinds?: FeeDateKind[];
}

export interface FeeDateOption {
    fee_date: string;
    label: string;
    heads: number;
    not_billed: number;
    students: number;
    unpaid_students: number;
}

export interface FeeDateOptions {
    schedule_fee_date: string | null;
    students: number;
    options: FeeDateOption[];
}

export interface FeeDatePreview {
    fee_date: string;
    fee_date_label: string;
    is_schedule_date: boolean;
    students: number;
    skipped_issued: number;
    counts: Record<"CLEARED" | "NOT_BILLED" | "BLOCKED", number>;
    owed_total: number;
}

export interface IssueResult {
    blob: Blob;
    filename: string;
    issued: number;
    reprinted: number;
}

const csv = (v?: Array<string | number>) => (v?.length ? v.join(",") : undefined);

/** A refused PDF request comes back as a Blob; turn it into the JSON error it carries. */
export async function readBlobError(err: unknown): Promise<{ message: string; code?: string }> {
    let data = (err as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
        try {
            data = JSON.parse(await data.text());
        } catch {
            return { message: "Request refused" };
        }
    }
    const body = data as { message?: unknown; code?: string } | undefined;
    const m = body?.message;
    return { message: Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : "Request failed", code: body?.code };
}

function filenameFrom(disposition: string | undefined, fallback: string) {
    const m = /filename="?([^";]+)"?/.exec(disposition ?? "");
    return m?.[1] ?? fallback;
}

export const examDocumentsService = {
    async listSchedules(params: { campus_ids?: number[]; academic_year?: string; q?: string } = {}): Promise<ExamScheduleSummary[]> {
        const { data } = await api.get("/v1/exam-documents/schedules", {
            params: { campus_ids: csv(params.campus_ids), academic_year: params.academic_year || undefined, q: params.q?.trim() || undefined },
        });
        return data.data ?? [];
    },
    async getSchedule(id: number): Promise<ExamSchedule> {
        const { data } = await api.get(`/v1/exam-documents/schedules/${id}`);
        return data.data;
    },
    async createSchedule(body: ExamScheduleUpsert): Promise<ExamSchedule> {
        const { data } = await api.post("/v1/exam-documents/schedules", body);
        return data.data;
    },
    async updateSchedule(id: number, body: ExamScheduleUpsert): Promise<ExamSchedule> {
        const { data } = await api.put(`/v1/exam-documents/schedules/${id}`, body);
        return data.data;
    },
    async setStatus(id: number, status: ExamScheduleStatus): Promise<ExamSchedule> {
        const { data } = await api.patch(`/v1/exam-documents/schedules/${id}/status`, { status });
        return data.data;
    },
    async deleteSchedule(id: number): Promise<void> {
        await api.delete(`/v1/exam-documents/schedules/${id}`);
    },
    async roster(id: number, query: RosterQuery): Promise<Roster> {
        const { data } = await api.get(`/v1/exam-documents/schedules/${id}/students`, {
            params: {
                class_ids: csv(query.class_ids),
                section_ids: csv(query.section_ids),
                states: csv(query.states),
                q: query.q?.trim() || undefined,
                disciplines: csv(query.disciplines),
                has_photo: query.has_photo || undefined,
                missing: csv(query.missing),
                fee_date_kinds: csv(query.fee_date_kinds),
            },
        });
        return data.data;
    },
    async setScheduleFeeDate(id: number, feeDate: string): Promise<ExamSchedule> {
        const { data } = await api.patch(`/v1/exam-documents/schedules/${id}/fee-date`, { fee_date: feeDate });
        return data.data;
    },
    async feeDateOptions(id: number): Promise<FeeDateOptions> {
        const { data } = await api.get(`/v1/exam-documents/schedules/${id}/fee-dates`);
        return data.data;
    },
    /** `feeDate` null puts the students back on the schedule's date. */
    async setStudentFeeDates(id: number, studentIds: number[], feeDate: string | null, reason?: string): Promise<{ updated: number; skipped_issued: number }> {
        const { data } = await api.put(`/v1/exam-documents/schedules/${id}/student-fee-dates`, {
            student_ids: studentIds,
            fee_date: feeDate,
            reason: reason?.trim() || undefined,
        });
        return data.data;
    },
    async previewFeeDate(id: number, studentIds: number[], feeDate: string): Promise<FeeDatePreview> {
        const { data } = await api.post(`/v1/exam-documents/schedules/${id}/student-fee-dates/preview`, { student_ids: studentIds, fee_date: feeDate });
        return data.data;
    },
    async issue(id: number, studentIds: number[]): Promise<IssueResult> {
        const res = await api.post(`/v1/exam-documents/schedules/${id}/documents`, { student_ids: studentIds }, { responseType: "blob" });
        return {
            blob: res.data,
            filename: filenameFrom(res.headers["content-disposition"], "exam-documents.pdf"),
            issued: Number(res.headers["x-issued-count"] ?? 0),
            reprinted: Number(res.headers["x-reprinted-count"] ?? 0),
        };
    },
    async override(id: number, studentId: number, reason: string): Promise<IssueResult> {
        const res = await api.post(
            `/v1/exam-documents/schedules/${id}/documents/override`,
            { student_id: studentId, reason },
            { responseType: "blob" },
        );
        return {
            blob: res.data,
            filename: filenameFrom(res.headers["content-disposition"], `exam-document-${studentId}.pdf`),
            issued: 1,
            reprinted: 0,
        };
    },
};

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
