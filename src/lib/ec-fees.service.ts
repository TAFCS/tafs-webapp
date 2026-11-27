import api from "./api";
import type {
    EcBulkAssignInput,
    EcBulkAssignPreview,
    EcBulkRemoveInput,
    EcBulkRemovePreview,
    EcChargeCell,
    EcClassScheduleCell,
    EcClassScheduleQuery,
    EcClassScheduleRow,
    EcFeeHead,
    EcFeeHeadInput,
    EcFeeHeadListQuery,
    EcFeeHeadOption,
    EcFeeHeadPatch,
    EcFeeHeadSearchHit,
    EcIssuable,
    EcPdfLink,
    EcStudentCharges,
    EcStudentClassAmount,
    EcStudentVouchers,
    EcVoucherDetail,
    EcVoucherFilters,
    EcVoucherList,
    EcVoucherSearchHit,
} from "./ec-fees.types";

/**
 * TAFSD-605: Extracurricular Fees. The only place the webapp calls the EC API,
 * so the contract has one definition. Pages never call `api` directly.
 * Extracurricular billing is separate from academic fees: nothing here touches
 * the academic voucher endpoints.
 */

type Envelope<T> = { data: T; status: number; message: string };

/** Arrays go out comma-joined; empty arrays and blank strings are dropped (empty = all). */
function params(q: Record<string, unknown>): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(q)) {
        if (v == null) continue;
        if (Array.isArray(v)) {
            if (v.length) out[k] = v.join(",");
        } else if (typeof v === "string") {
            if (v.trim()) out[k] = v.trim();
        } else if (typeof v === "number" || typeof v === "boolean") {
            out[k] = v;
        }
    }
    return out;
}

export const ecFeesService = {
    // ── Fee heads ──────────────────────────────────────────────────────────
    async listFeeHeads(query: EcFeeHeadListQuery = {}): Promise<EcFeeHead[]> {
        const { data } = await api.get<Envelope<EcFeeHead[]>>("/v1/ec-fee-heads", { params: params({ ...query }) });
        return data.data;
    },

    async feeHeadOptions(): Promise<EcFeeHeadOption[]> {
        const { data } = await api.get<Envelope<EcFeeHeadOption[]>>("/v1/ec-fee-heads/options");
        return data.data;
    },

    /** Empty text finds nothing (server-side, Rule 2). */
    async searchFeeHeads(q: string): Promise<EcFeeHeadSearchHit[]> {
        if (!q.trim()) return [];
        const { data } = await api.get<Envelope<EcFeeHeadSearchHit[]>>("/v1/ec-fee-heads/search-simple", { params: { q: q.trim() } });
        return data.data;
    },

    async createFeeHead(input: EcFeeHeadInput): Promise<EcFeeHead> {
        const { data } = await api.post<Envelope<EcFeeHead>>("/v1/ec-fee-heads", input);
        return data.data;
    },

    async updateFeeHead(id: number, patch: EcFeeHeadPatch): Promise<EcFeeHead> {
        const { data } = await api.patch<Envelope<EcFeeHead>>(`/v1/ec-fee-heads/${id}`, patch);
        return data.data;
    },

    async deleteFeeHead(id: number): Promise<void> {
        await api.delete(`/v1/ec-fee-heads/${id}`);
    },

    // ── Class amounts ──────────────────────────────────────────────────────
    async listClassSchedule(query: EcClassScheduleQuery): Promise<EcClassScheduleRow[]> {
        const { data } = await api.get<Envelope<EcClassScheduleRow[]>>("/v1/ec-class-fee-schedule", { params: params({ ...query }) });
        return data.data;
    },

    async saveClassSchedule(academicYear: string, cells: EcClassScheduleCell[]): Promise<{ saved: number; cleared: number }> {
        const { data } = await api.put<Envelope<{ saved: number; cleared: number }>>("/v1/ec-class-fee-schedule", {
            academic_year: academicYear,
            cells,
        });
        return data.data;
    },

    async copyClassScheduleYear(fromYear: string, toYear: string, overwrite: boolean) {
        const { data } = await api.post<Envelope<{ from: string; to: string; created: number; updated: number; kept: number }>>(
            "/v1/ec-class-fee-schedule/copy-year",
            { from_year: fromYear, to_year: toYear, overwrite },
        );
        return data.data;
    },

    // ── Student charges ────────────────────────────────────────────────────
    async studentCharges(cc: number, academicYears: string[] = []): Promise<EcStudentCharges> {
        const { data } = await api.get<Envelope<EcStudentCharges>>(`/v1/ec-student-charges/student/${cc}`, {
            params: params({ academic_years: academicYears }),
        });
        return data.data;
    },

    async studentClassAmounts(cc: number, academicYear: string): Promise<EcStudentClassAmount[]> {
        const { data } = await api.get<Envelope<EcStudentClassAmount[]>>(`/v1/ec-student-charges/student/${cc}/class-amounts`, {
            params: { academic_year: academicYear },
        });
        return data.data;
    },

    async saveStudentCharges(cc: number, academicYear: string, cells: EcChargeCell[]): Promise<{ created: number; updated: number; removed: number }> {
        const { data } = await api.post<Envelope<{ created: number; updated: number; removed: number }>>(
            `/v1/ec-student-charges/student/${cc}/save`,
            { academic_year: academicYear, cells },
        );
        return data.data;
    },

    async bulkAssignPreview(input: EcBulkAssignInput): Promise<EcBulkAssignPreview> {
        const { data } = await api.post<Envelope<EcBulkAssignPreview>>("/v1/ec-student-charges/bulk-assign/preview", input);
        return data.data;
    },

    async bulkAssign(input: EcBulkAssignInput): Promise<EcBulkAssignPreview & { created: number }> {
        const { data } = await api.post<Envelope<EcBulkAssignPreview & { created: number }>>("/v1/ec-student-charges/bulk-assign", input);
        return data.data;
    },

    async bulkRemovePreview(input: EcBulkRemoveInput): Promise<EcBulkRemovePreview> {
        const { data } = await api.post<Envelope<EcBulkRemovePreview>>("/v1/ec-student-charges/bulk-remove/preview", input);
        return data.data;
    },

    async bulkRemove(input: EcBulkRemoveInput): Promise<EcBulkRemovePreview & { removed: number }> {
        const { data } = await api.post<Envelope<EcBulkRemovePreview & { removed: number }>>("/v1/ec-student-charges/bulk-remove", input);
        return data.data;
    },

    // ── Vouchers ───────────────────────────────────────────────────────────
    async listVouchers(filters: EcVoucherFilters, page: number, limit: number): Promise<EcVoucherList> {
        const { data } = await api.get<Envelope<EcVoucherList>>("/v1/ec-vouchers", { params: params({ ...filters, page, limit }) });
        return data.data;
    },

    /** Empty text finds nothing (server-side, Rule 2). */
    async searchVouchers(q: string): Promise<EcVoucherSearchHit[]> {
        if (!q.trim()) return [];
        const { data } = await api.get<Envelope<EcVoucherSearchHit[]>>("/v1/ec-vouchers/search-simple", { params: { q: q.trim() } });
        return data.data;
    },

    async voucher(id: number): Promise<EcVoucherDetail> {
        const { data } = await api.get<Envelope<EcVoucherDetail>>(`/v1/ec-vouchers/${id}`);
        return data.data;
    },

    async studentVouchers(cc: number): Promise<EcStudentVouchers> {
        const { data } = await api.get<Envelope<EcStudentVouchers>>(`/v1/ec-vouchers/student/${cc}`);
        return data.data;
    },

    async issuable(cc: number): Promise<EcIssuable> {
        const { data } = await api.get<Envelope<EcIssuable>>("/v1/ec-vouchers/issuable", { params: { student_id: cc } });
        return data.data;
    },

    async issueVoucher(input: { student_id: number; charge_ids: number[]; issue_date: string; expiry_date?: string; bank_account_id?: number }): Promise<EcVoucherDetail> {
        const { data } = await api.post<Envelope<EcVoucherDetail>>("/v1/ec-vouchers", input);
        return data.data;
    },

    async deleteVoucher(id: number): Promise<void> {
        await api.delete(`/v1/ec-vouchers/${id}`);
    },

    async voucherPdf(id: number): Promise<EcPdfLink> {
        const { data } = await api.post<Envelope<EcPdfLink>>(`/v1/ec-vouchers/${id}/pdf`, {}, { timeout: 120_000 });
        return data.data;
    },

    /** Up to 25 challans rendered and stored (call in chunks). */
    async preparePdfs(ids: number[]): Promise<(EcPdfLink & { id: number })[]> {
        const { data } = await api.post<Envelope<(EcPdfLink & { id: number })[]>>("/v1/ec-vouchers/pdf/prepare", { ids }, { timeout: 180_000 });
        return data.data;
    },

    /** Up to 500 challans in one PDF. */
    async mergedPdf(ids: number[]): Promise<EcPdfLink & { count: number }> {
        const { data } = await api.post<Envelope<EcPdfLink & { count: number }>>("/v1/ec-vouchers/batch-merge", { ids }, { timeout: 300_000 });
        return data.data;
    },

    async exportVouchers(filters: EcVoucherFilters): Promise<Blob> {
        const { data } = await api.get<Blob>("/v1/ec-vouchers/export", { params: params({ ...filters }), responseType: "blob", timeout: 120_000 });
        return data;
    },
};

/** Fetch a stored PDF and save it under `filename`; falls back to opening it. */
export async function ecDownload(url: string, filename: string) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
    } catch {
        window.open(url, "_blank");
    }
}

/** Save a Blob (an export) under `filename`. */
export function ecSaveBlob(blob: Blob, filename: string) {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
}
