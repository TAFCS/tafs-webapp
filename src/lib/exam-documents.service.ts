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

/** TAFSD-525: which of the school's sheets a schedule's Excel export copies. */
export type ScheduleLayout = "SECONDARY" | "O_LEVEL" | "SENIOR" | "JUNIOR";
export const SCHEDULE_LAYOUTS: ScheduleLayout[] = ["SECONDARY", "O_LEVEL", "SENIOR", "JUNIOR"];
export const SCHEDULE_LAYOUT_LABELS: Record<ScheduleLayout, string> = {
    SECONDARY: "Secondary (VI–X)",
    O_LEVEL: "O Levels (a timing per level)",
    SENIOR: "Senior Cambridge",
    JUNIOR: "Junior Cambridge",
};
/** The layout a schedule takes when none was chosen. Mirrors the backend's inferScheduleLayout. */
export function inferScheduleLayout(classIds: number[]): ScheduleLayout {
    if (!classIds.length) return "SECONDARY";
    const all = (lo: number, hi: number) => classIds.every((id) => id >= lo && id <= hi);
    if (all(15, 19)) return "SECONDARY";
    if (all(12, 14)) return "O_LEVEL";
    if (all(4, 8)) return "JUNIOR";
    return "SENIOR";
}

/** TAFSD-525: a preset's paper row, without a date. Keys are class ids. */
export interface ExamPresetRow {
    time: string;
    cells: Record<string, string>;
    times?: Record<string, string>;
}

export interface ExamPreset {
    id: number;
    name: string;
    layout: ScheduleLayout;
    title: string;
    segment_line: string | null;
    classes: { id: number; description: string }[];
    rows: ExamPresetRow[];
    notes: string[];
    /** TAFSD-555: the front-of-document note a schedule made from it starts with. */
    document_notes: string[];
    created_by: string | null;
    updated_at: string;
}

export interface ExamPresetCreate {
    name: string;
    layout: ScheduleLayout;
    title: string;
    segment_line?: string;
    class_ids: number[];
    rows: ExamPresetRow[];
    notes: string[];
    document_notes?: string[];
}

/** TAFSD-555: an unsaved schedule as the front-note preview takes it; papers may still be half filled in. */
export interface FrontNotePreviewRequest {
    campus_id: number;
    academic_year?: string;
    title?: string;
    segment_line?: string;
    document_notes: string[];
    class_ids: number[];
    papers: { class_id: number; paper_date?: string; time_text?: string; subject?: string; code?: string }[];
    /** The class whose page to return; left out, the tightest. */
    class_id?: number;
}

export interface FrontNotePreviewClass {
    class_id: number;
    class_name: string;
    doc_type: ExamDocType;
    papers: number;
    /** The front note is empty, so the two standard lines print. */
    standard_lines: boolean;
    /** False: the front page spills onto a second sheet even at the smallest sizes. */
    fits: boolean;
    note_size: number;
    full_note_size: number;
    /** The note (and the paper rows) print smaller than usual to fit. */
    shrunk: boolean;
    table_size: number;
}

export interface FrontNotePreview {
    lines: number;
    max_lines: number;
    classes: FrontNotePreviewClass[];
    shown_class_id: number;
    tightest_class_id: number;
    /** The front page of `shown_class_id`, rendered by the code that prints the documents. */
    pdf_base64: string;
}

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
    /** Printed on the schedule sheet and its Excel export. A results / PTM line also ends the back of a statement of entry. */
    notes: string[];
    /** TAFSD-555: the box under the papers on the front of every statement of entry and admit card. Empty: the two standard lines. */
    document_notes: string[];
    layout: ScheduleLayout;
    /** False when the layout was taken from the classes rather than chosen. */
    layout_chosen: boolean;
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
    layout?: ScheduleLayout;
    fee_date: string;
    issue_from?: string;
    notes: string[];
    document_notes?: string[];
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
    /** TAFSD-544: released to the parent app; null until released. */
    released_at?: string | null;
    released_by?: string | null;
    release_message?: string | null;
    /** When the parent first opened it in the app. */
    parent_opened_at?: string | null;
}

/** TAFSD-544: what one release did with each student asked for. */
export type ReleaseOutcome = "RELEASED" | "ALREADY_RELEASED" | "NOT_ISSUED" | "NO_FAMILY" | "NOT_FOUND";
export interface ReleaseResult {
    released: number;
    already_released: number;
    not_issued: number;
    no_family: number;
    not_found: number;
    students: { cc: number; name: string; outcome: ReleaseOutcome; reason: string }[];
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
    /** Null when nothing could be printed: the run report says why. */
    blob: Blob | null;
    filename: string;
    issued: number;
    reprinted: number;
    /** TAFSD-543: students the run left out, each with a reason in the report. */
    skipped: number;
    /** The saved run report; null if it could not be saved. */
    runId: number | null;
    /** Documents were issued but the PDF could not be made. */
    error: string | null;
}

/** TAFSD-543: the report of one Issue run. */
export type RunOutcome = "ISSUED" | "REPRINTED" | "SKIPPED";
export type SkipCode = "NOT_FOUND" | "NOT_ENROLLED" | "OTHER_CAMPUS" | "CLASS_NOT_ON_SCHEDULE" | "DUES_NOT_CLEARED" | "NOT_BILLED" | "ALREADY_ISSUED";
export type GapCode = "NO_PHOTO" | "PHOTO_UNREADABLE" | "NO_FATHER" | "NO_DOB";

export const SKIP_LABELS: Record<SkipCode, string> = {
    DUES_NOT_CLEARED: "Dues not cleared",
    NOT_BILLED: "Fees not billed",
    ALREADY_ISSUED: "Already issued",
    NOT_ENROLLED: "Not enrolled",
    OTHER_CAMPUS: "Other campus",
    CLASS_NOT_ON_SCHEDULE: "Class not on schedule",
    NOT_FOUND: "Not found",
};
export const GAP_LABELS: Record<GapCode, string> = {
    NO_PHOTO: "No photo",
    PHOTO_UNREADABLE: "Photo unreadable",
    NO_FATHER: "No father's name",
    NO_DOB: "No date of birth",
};

export interface RunStudent {
    cc: number;
    gr: string | null;
    name: string;
    class: string | null;
    section: string | null;
    outcome: RunOutcome;
    reason_code: SkipCode | null;
    reason: string | null;
    owed: number | null;
    fee_date: string | null;
    serial: string | null;
    gaps: GapCode[];
}

export interface RunCounts {
    requested: number;
    issued: number;
    reprinted: number;
    skipped: number;
    with_gaps: number;
}

export interface IssueRunSummary extends RunCounts {
    id: number;
    label: string;
    error: string | null;
    created_by: string;
    created_at: string;
}

export interface IssueRun {
    id: number;
    schedule_id: number;
    label: string;
    created_by: string;
    created_at: string;
    error: string | null;
    counts: RunCounts;
    /** Students in the run outside your access, left out of this view. */
    hidden: number;
    students: RunStudent[];
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
    /** TAFSD-555: the editor's live preview: each class's front page from the unsaved draft, laid out as it prints. */
    async previewFrontNote(body: FrontNotePreviewRequest, signal?: AbortSignal): Promise<FrontNotePreview> {
        const { data } = await api.post("/v1/exam-documents/schedules/front-note-preview", body, { signal });
        return data.data;
    },
    async previewFeeDate(id: number, studentIds: number[], feeDate: string): Promise<FeeDatePreview> {
        const { data } = await api.post(`/v1/exam-documents/schedules/${id}/student-fee-dates/preview`, { student_ids: studentIds, fee_date: feeDate });
        return data.data;
    },
    /** TAFSD-524: the schedule as an Excel sheet in the school's own layout. */
    async listPresets(): Promise<ExamPreset[]> {
        const { data } = await api.get("/v1/exam-documents/presets");
        return data.data ?? [];
    },
    async createPreset(body: ExamPresetCreate): Promise<ExamPreset> {
        const { data } = await api.post("/v1/exam-documents/presets", body);
        return data.data;
    },
    async deletePreset(id: number): Promise<void> {
        await api.delete(`/v1/exam-documents/presets/${id}`);
    },
    async exportSchedule(id: number): Promise<{ blob: Blob; filename: string }> {
        const res = await api.get(`/v1/exam-documents/schedules/${id}/export`, { responseType: "blob" });
        return { blob: res.data, filename: filenameFrom(res.headers["content-disposition"], `exam-schedule-${id}.xlsx`) };
    },
    /**
     * TAFSD-543: one Issue run. Cleared students are issued, holders reprinted (or,
     * with `skipHolders`, left alone) and the rest skipped with a reason in the run
     * report. With nothing to print the backend answers with JSON instead of a PDF.
     */
    async issue(id: number, studentIds: number[], opts: { skipHolders?: boolean } = {}): Promise<IssueResult> {
        const res = await api.post(
            `/v1/exam-documents/schedules/${id}/documents`,
            { student_ids: studentIds, skip_holders: opts.skipHolders || undefined },
            { responseType: "blob" },
        );
        const runId = Number(res.headers["x-run-id"]) || null;
        const counts = {
            issued: Number(res.headers["x-issued-count"] ?? 0),
            reprinted: Number(res.headers["x-reprinted-count"] ?? 0),
            skipped: Number(res.headers["x-skipped-count"] ?? 0),
        };
        const blob = res.data as Blob;
        if (!String(res.headers["content-type"] ?? "").includes("application/pdf")) {
            let error: string | null = null;
            try {
                error = JSON.parse(await blob.text())?.data?.error ?? null;
            } catch {
                /* the counts in the headers are enough */
            }
            return { blob: null, filename: "", ...counts, runId, error };
        }
        return { blob, filename: filenameFrom(res.headers["content-disposition"], "exam-documents.pdf"), ...counts, runId, error: null };
    },
    /** TAFSD-544: release issued documents to the parent app, with the school's optional message. */
    async release(id: number, studentIds: number[], message?: string): Promise<ReleaseResult> {
        const { data } = await api.post(`/v1/exam-documents/schedules/${id}/documents/release`, {
            student_ids: studentIds,
            message: message?.trim() || undefined,
        });
        return data.data;
    },
    /** TAFSD-544: undo a release; the card leaves the parent app, with no notification. */
    async unrelease(id: number, studentIds: number[]): Promise<{ unreleased: number; not_released: number; not_found: number }> {
        const { data } = await api.post(`/v1/exam-documents/schedules/${id}/documents/unrelease`, { student_ids: studentIds });
        return data.data;
    },
    async listRuns(id: number): Promise<IssueRunSummary[]> {
        const { data } = await api.get(`/v1/exam-documents/schedules/${id}/runs`);
        return data.data ?? [];
    },
    async getRun(id: number, runId: number): Promise<IssueRun> {
        const { data } = await api.get(`/v1/exam-documents/schedules/${id}/runs/${runId}`);
        return data.data;
    },
    async exportRun(id: number, runId: number): Promise<{ blob: Blob; filename: string }> {
        const res = await api.get(`/v1/exam-documents/schedules/${id}/runs/${runId}/export`, { responseType: "blob" });
        return { blob: res.data, filename: filenameFrom(res.headers["content-disposition"], `issue-report-${runId}.xlsx`) };
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
            skipped: 0,
            runId: null,
            error: null,
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

/**
 * TAFSD-555: the two lines the front of a document prints when its schedule has no front
 * note of its own. Same text as the backend's `standardFrontNotes` (ExamDocumentPDF.tsx).
 */
export function standardFrontNotes(docType: ExamDocType): string[] {
    const doc = docType === "ADMIT_CARD" ? "admit card" : "statement of entry";
    return [
        "All entry details, including the spelling of your name and date of birth, must be checked for accuracy.",
        `Bring this ${doc} every day until the last day of the assessments.`,
    ].map((n) => n.toUpperCase());
}
