import api from "./api";
import type {
    EcClassScheduleCell,
    EcClassScheduleQuery,
    EcClassScheduleRow,
    EcFeeHead,
    EcFeeHeadInput,
    EcFeeHeadListQuery,
    EcFeeHeadOption,
    EcFeeHeadPatch,
    EcFeeHeadSearchHit,
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
};
