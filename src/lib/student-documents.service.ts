import api from "./api";

/** TAFSD-498: the student document vault. */

export type DocOwner = "STUDENT" | "GUARDIAN";
export type DocOrigin = "PROVIDED" | "GENERATED";

export interface DocumentType {
    id: number;
    code: string;
    name: string;
    description: string | null;
    owner: DocOwner;
    origin: DocOrigin;
    allow_multiple: boolean;
    required_at_admission: boolean;
    restricted: boolean;
    visible_to_parents: boolean;
    is_system: boolean;
    is_active: boolean;
    display_order: number;
    document_count?: number;
    /** Restricted and the caller can't see it. */
    locked?: boolean;
}

export interface DocumentVersion {
    id: number;
    version_no: number;
    mime_type: string;
    size_bytes: number;
    original_filename: string | null;
    page_count: number | null;
    channel: string;
    note: string | null;
    uploaded_by: string;
    uploaded_at: string;
}

export interface VaultDocument {
    id: number;
    type_id: number;
    student_id: number | null;
    guardian_id: number | null;
    title: string | null;
    academic_year: string | null;
    source_ref: string | null;
    archived_at: string | null;
    archived_by: string | null;
    archive_reason: string | null;
    created_by: string;
    created_at: string;
    current: DocumentVersion | null;
    versions: DocumentVersion[];
}

export interface MissingItem {
    type_id: number;
    type_code: string;
    type_name: string;
    guardian_id: number | null;
    label: string;
}

export interface VaultGuardian {
    id: number;
    full_name: string | null;
    relationship: string;
    is_primary_contact: boolean;
}

export interface VaultPermissions {
    upload: boolean;
    replace: boolean;
    archive: boolean;
    viewRestricted: boolean;
}

export interface Vault {
    student: {
        cc: number;
        full_name: string;
        gr_number: string | null;
        photograph_url: string | null;
        status: string;
        class_name: string | null;
        section_name: string | null;
        campus_name: string | null;
    };
    guardians: VaultGuardian[];
    types: DocumentType[];
    documents: VaultDocument[];
    hidden_restricted_count: number;
    missing: MissingItem[];
    completeness: { required: number; on_file: number };
    permissions: VaultPermissions;
}

export interface CompletenessSummary {
    cc: number;
    required: number;
    on_file: number;
    missing: string[];
}

export interface MissingRow {
    cc: number;
    full_name: string;
    gr_number: string | null;
    status: string;
    photograph_url: string | null;
    campus_name: string | null;
    class_name: string | null;
    section_name: string | null;
    required: number;
    on_file: number;
    missing: MissingItem[];
}

export interface MissingReport {
    items: MissingRow[];
    meta: { total: number; page: number; limit: number; students_checked: number; students_complete: number };
    by_type: { type_id: number; type_code: string; name: string; owner: DocOwner; students_missing: number }[];
}

export interface MissingFilters {
    q?: string;
    campus_ids?: number[];
    class_ids?: number[];
    section_ids?: number[];
    type_ids?: number[];
    statuses?: string[];
    page?: number;
    limit?: number;
    all?: boolean;
}

export interface VaultActivity {
    id: number;
    action: "UPLOADED" | "REPLACED" | "ARCHIVED" | "RESTORED" | "MADE_CURRENT";
    note: string | null;
    changed_by: string;
    changed_at: string;
    cc: number;
    full_name: string | null;
    gr_number: string | null;
    class_name: string | null;
    section_name: string | null;
}

export interface UploadInput {
    files: File[];
    type_id: number;
    guardian_id?: number | null;
    document_id?: number | null;
    title?: string;
    academic_year?: string;
    note?: string;
}

export type DocumentTypeInput = Partial<
    Pick<DocumentType, "name" | "description" | "owner" | "allow_multiple" | "required_at_admission" | "restricted" | "is_active" | "display_order">
>;

const unwrap = <T,>(res: { data?: { data?: T } }) => res.data?.data as T;
const csv = (ids?: Array<number | string>) => (ids && ids.length ? ids.join(",") : undefined);

export const studentDocumentsService = {
    async types(includeInactive = true): Promise<DocumentType[]> {
        return unwrap(await api.get("/v1/student-documents/types", { params: { include_inactive: includeInactive } }));
    },
    async createType(data: DocumentTypeInput & { name: string }): Promise<DocumentType> {
        return unwrap(await api.post("/v1/student-documents/types", data));
    },
    async updateType(id: number, data: DocumentTypeInput): Promise<DocumentType> {
        return unwrap(await api.patch(`/v1/student-documents/types/${id}`, data));
    },

    async vault(cc: number): Promise<Vault> {
        return unwrap(await api.get(`/v1/student-documents/students/${cc}`));
    },
    async summary(ccs: number[]): Promise<CompletenessSummary[]> {
        if (!ccs.length) return [];
        return unwrap(await api.get("/v1/student-documents/summary", { params: { ccs: ccs.join(",") } }));
    },
    async missing(f: MissingFilters): Promise<MissingReport> {
        return unwrap(
            await api.get("/v1/student-documents/missing", {
                params: {
                    q: f.q || undefined,
                    campus_ids: csv(f.campus_ids),
                    class_ids: csv(f.class_ids),
                    section_ids: csv(f.section_ids),
                    type_ids: csv(f.type_ids),
                    statuses: csv(f.statuses),
                    page: f.page,
                    limit: f.limit,
                    all: f.all || undefined,
                },
                timeout: 60_000,
            }),
        );
    },
    async activity(before?: number, limit = 40): Promise<VaultActivity[]> {
        return unwrap(await api.get("/v1/student-documents/activity", { params: { before, limit } }));
    },

    /** A 5-minute signed link. Every call is logged as a view or download. */
    async link(versionId: number, disposition: "inline" | "attachment" = "inline", cc?: number) {
        return unwrap<{ url: string; filename: string; mime_type: string; expires_in: number }>(
            await api.get(`/v1/student-documents/versions/${versionId}/link`, { params: { disposition, cc } }),
        );
    },

    async upload(cc: number, input: UploadInput, onProgress?: (pct: number) => void) {
        const form = new FormData();
        input.files.forEach((f) => form.append("files", f));
        form.append("type_id", String(input.type_id));
        if (input.guardian_id) form.append("guardian_id", String(input.guardian_id));
        if (input.document_id) form.append("document_id", String(input.document_id));
        if (input.title?.trim()) form.append("title", input.title.trim());
        if (input.academic_year?.trim()) form.append("academic_year", input.academic_year.trim());
        if (input.note?.trim()) form.append("note", input.note.trim());
        const res = await api.post(`/v1/student-documents/students/${cc}/upload`, form, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 120_000,
            onUploadProgress: (e) => {
                if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
            },
        });
        return unwrap<{ document_id: number; version: DocumentVersion; replaced: boolean }>(res);
    },
    // `cc` is the student the user has open: a parent's document is shared by
    // siblings, and the log entry should land on the child being looked at.
    async makeCurrent(documentId: number, versionId: number, cc?: number) {
        return unwrap<DocumentVersion>(await api.post(`/v1/student-documents/${documentId}/versions/${versionId}/make-current`, null, { params: { cc } }));
    },
    async archive(documentId: number, reason: string, cc?: number) {
        await api.post(`/v1/student-documents/${documentId}/archive`, { reason }, { params: { cc } });
    },
    async restore(documentId: number, cc?: number) {
        await api.post(`/v1/student-documents/${documentId}/restore`, null, { params: { cc } });
    },
};

export const errMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string, withTime = false): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    });
}
