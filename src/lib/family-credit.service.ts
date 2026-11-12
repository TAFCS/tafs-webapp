import api from "./api";

/**
 * TAFSD-504: Finance → Family Credit. Every balance and rule is the backend's;
 * this only carries requests. Ledger rows are append-only: an undo is a new row.
 */

export interface FamilyCreditStudent {
    cc: number;
    full_name: string;
    gr_number: string | null;
    campus_id?: number | null;
    campus_name?: string | null;
    class_name: string | null;
    section_name?: string | null;
}

export interface FamilyCreditRow {
    family_id: number;
    household_name: string;
    legacy_pid: string | null;
    family_deleted: boolean;
    balance: number;
    last_movement_at: string | null;
    entries: number;
    students: FamilyCreditStudent[];
}

export interface FamilyCreditList {
    items: FamilyCreditRow[];
    meta: { page: number; limit: number; total: number; total_pages: number };
    totals: { families: number; families_holding_credit: number; total_balance: number };
}

export interface FamilyCreditEntry {
    id: number;
    amount: number;
    kind: string;
    kind_label: string;
    student_id: number | null;
    student_name: string | null;
    voucher_id: number | null;
    deposit_id: number | null;
    notes: string | null;
    method: string | null;
    created_by: string | null;
    created_at: string;
    counterpart_family_id: number | null;
    counterpart_family_name: string | null;
    reverses_entry_id: number | null;
    undone_by_entry_id: number | null;
    can_undo: boolean;
}

export interface FamilyCreditDetail {
    family_id: number;
    household_name: string;
    legacy_pid: string | null;
    family_deleted: boolean;
    balance: number;
    students: FamilyCreditStudent[];
    entries: FamilyCreditEntry[];
}

export interface FamilySearchHit {
    family_id: number;
    household_name: string;
    legacy_pid: string | null;
    balance: number;
    students: Array<Pick<FamilyCreditStudent, "cc" | "full_name" | "gr_number" | "class_name">>;
}

export interface FamilyCreditListQuery {
    q?: string;
    campus_ids?: number[];
    include_zero?: boolean;
    sort_by?: "balance" | "last_movement" | "family";
    sort_dir?: "asc" | "desc";
    page?: number;
    limit?: number;
}

export type RefundMethod = "cash" | "cheque" | "bank_transfer";

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
    cash: "Cash",
    cheque: "Cheque",
    bank_transfer: "Bank transfer",
};

const toParams = (q: FamilyCreditListQuery) => ({
    q: q.q?.trim() || undefined,
    campus_ids: q.campus_ids?.length ? q.campus_ids.join(",") : undefined,
    include_zero: q.include_zero ? "true" : undefined,
    sort_by: q.sort_by,
    sort_dir: q.sort_dir,
    page: q.page,
    limit: q.limit,
});

export const familyCreditService = {
    async list(query: FamilyCreditListQuery): Promise<FamilyCreditList> {
        const { data } = await api.get("/v1/family-credit", { params: toParams(query) });
        return data.data;
    },
    async searchSimple(q: string): Promise<FamilySearchHit[]> {
        if (!q.trim()) return [];
        const { data } = await api.get("/v1/family-credit/search-simple", { params: { q: q.trim() } });
        return data.data ?? [];
    },
    async detail(familyId: number): Promise<FamilyCreditDetail> {
        const { data } = await api.get(`/v1/family-credit/${familyId}`);
        return data.data;
    },
    async add(familyId: number, amount: number, reason: string): Promise<FamilyCreditDetail> {
        const { data } = await api.post(`/v1/family-credit/${familyId}/add`, { amount, reason });
        return data.data;
    },
    async deduct(familyId: number, amount: number, reason: string): Promise<FamilyCreditDetail> {
        const { data } = await api.post(`/v1/family-credit/${familyId}/deduct`, { amount, reason });
        return data.data;
    },
    async refund(familyId: number, amount: number, method: RefundMethod, reason: string): Promise<FamilyCreditDetail> {
        const { data } = await api.post(`/v1/family-credit/${familyId}/refund`, { amount, method, reason });
        return data.data;
    },
    async transfer(familyId: number, toFamilyId: number, amount: number, reason: string): Promise<FamilyCreditDetail> {
        const { data } = await api.post(`/v1/family-credit/${familyId}/transfer`, { to_family_id: toFamilyId, amount, reason });
        return data.data;
    },
    async undo(entryId: number, reason: string): Promise<FamilyCreditDetail> {
        const { data } = await api.post(`/v1/family-credit/entries/${entryId}/undo`, { reason });
        return data.data;
    },
    async exportExcel(query: FamilyCreditListQuery): Promise<Blob> {
        const { data } = await api.get("/v1/family-credit/export", {
            params: { ...toParams(query), page: undefined, limit: undefined },
            responseType: "blob",
        });
        return data;
    },
};
