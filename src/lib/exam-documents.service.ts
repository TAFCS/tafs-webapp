import api from "./api";

/**
 * TAFSD-510: Student → Exam Documents. Schedules, and admit cards (VI–X) /
 * statements of entry (every other class) issued to students whose dues are
 * cleared through the schedule's fee month. The dues check and every rule are
 * the backend's; this only carries requests.
 */

export type ExamDocType = "ADMIT_CARD" | "STATEMENT_OF_ENTRY";
export type ExamScheduleStatus = "DRAFT" | "PUBLISHED";
export type RosterState = "ISSUED" | "CLEARED" | "BLOCKED";

export const DOC_TYPE_LABELS: Record<ExamDocType, string> = {
    ADMIT_CARD: "Admit card",
    STATEMENT_OF_ENTRY: "Statement of entry",
};

export const ROSTER_STATE_LABELS: Record<RosterState, string> = {
    CLEARED: "Cleared",
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
    dues_cleared_through: string;
    dues_month_label: string;
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
    dues_cleared_through: string;
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
    has_photo: boolean;
    state: RosterState;
    owed: number;
    heads_outstanding: number;
    surcharge_outstanding: number;
    oldest_unpaid_fee_date: string | null;
    document: ExamDocumentInfo | null;
}

export interface Roster {
    schedule: ExamScheduleSummary;
    dues_cleared_through: string;
    issue_window_open: boolean;
    counts: Record<RosterState, number>;
    blocked_owed_total: number;
    rows: RosterRow[];
}

export interface RosterQuery {
    class_ids?: number[];
    section_ids?: number[];
    states?: RosterState[];
    q?: string;
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
            },
        });
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
