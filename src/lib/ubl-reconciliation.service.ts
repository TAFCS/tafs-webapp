import api from "./api";

/**
 * UBL Collections tab of Financial Reports: every UBL payment TAFS booked,
 * matched against the settlement statements UBL sends.
 */

export const UBL_RECON_STATUSES = [
  { value: "MATCHED", label: "Matched", tone: "emerald" },
  { value: "AMOUNT_DIFFERS", label: "Amount differs", tone: "amber" },
  { value: "DUPLICATE_IN_SETTLEMENT", label: "Settled more than once", tone: "amber" },
  { value: "NOT_SETTLED", label: "Not in UBL settlement", tone: "sky" },
  { value: "NOT_AT_TAFS", label: "Not booked at TAFS", tone: "rose" },
  { value: "REVERSED_BUT_SETTLED", label: "Reversed at TAFS, settled by UBL", tone: "rose" },
  { value: "REVERSED_NOT_SETTLED", label: "Reversed at TAFS, not settled", tone: "zinc" },
] as const;
export type UblReconStatus = (typeof UBL_RECON_STATUSES)[number]["value"];

export const UBL_CHANNELS = [
  { value: "OTC", label: "Branch (OTC)" },
  { value: "APP", label: "UBL app" },
  { value: "INTERNET_BANKING", label: "Internet banking" },
  { value: "ONEBILL", label: "1Bill" },
] as const;

export type UblReconRow = {
  transaction_id: string;
  status: UblReconStatus;
  date: string | null;
  channel: string | null;
  cc: number | null;
  student_name: string | null;
  campus: string | null;
  consumer_number: string | null;
  voucher_number: string | null;
  payment_method: string | null;
  transaction_at: string | null;
  tafs_received: number | null;
  tafs_booked: number | null;
  channel_fee: number | null;
  deposit_id: number | null;
  deposit_reversed: boolean | null;
  ubl_amount: number | null;
  ubl_count: number;
  ubl_transaction_date: string | null;
  ubl_settlement_date: string | null;
  ubl_import_ids: number[];
  expected: number;
  difference: number;
  note: string | null;
};

export type UblReconTotals = {
  tafs_count: number;
  tafs_booked: number;
  tafs_received: number;
  tafs_channel_fee: number;
  reversed_count: number;
  reversed_booked: number;
  ubl_count: number;
  ubl_amount: number;
  difference: number;
  status_counts: Record<UblReconStatus, number>;
  exceptions: number;
};

export type UblDailyTotal = {
  date: string;
  channel: string;
  tafs_count: number;
  tafs_amount: number;
  ubl_count: number;
  ubl_amount: number;
  difference: number;
};

export type UblSettlementImport = {
  id: number;
  file_name: string;
  sheet_name: string | null;
  uploaded_by: string;
  uploaded_at: string;
  row_count: number;
  skipped_rows: number;
  total_amount: number;
  first_date: string | null;
  last_date: string | null;
  already_imported_lines?: number;
};

export type MappingField = "transaction_id" | "amount" | "transaction_date" | "settlement_date" | "channel" | "consumer_number";
export type ColumnMapping = Partial<Record<MappingField, string>>;

export type UblSettlementPreview = {
  file_name: string;
  sheets: string[];
  sheet: string;
  header_row: number;
  headers: string[];
  row_count: number;
  sample_rows: string[][];
  suggested_mapping: ColumnMapping;
  mapping_source: "last_upload" | "guessed";
  fields: { key: MappingField; label: string; required: boolean }[];
};

export type UblReconQuery = {
  from_date: string;
  to_date: string;
  status?: string;
  channel?: string;
  q?: string;
  page?: number;
  limit?: number;
};

const clean = (p: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ""));

export const ublReconciliationService = {
  async reconciliation(params: UblReconQuery) {
    const res = await api.get("/v1/financial-reports/ubl/reconciliation", { params: clean(params) });
    return res.data?.data as {
      items: UblReconRow[];
      pagination: { page: number; limit: number; total: number; pages: number; hasNext: boolean; hasPrev: boolean };
      totals: UblReconTotals;
      daily: UblDailyTotal[];
    };
  },
  async listSettlements() {
    const res = await api.get("/v1/financial-reports/ubl/settlements");
    return (res.data?.data ?? []) as UblSettlementImport[];
  },
  async previewSettlement(file: File, opts: { sheet?: string; header_row?: number } = {}) {
    const form = new FormData();
    form.append("file", file);
    if (opts.sheet) form.append("sheet", opts.sheet);
    if (opts.header_row) form.append("header_row", String(opts.header_row));
    const res = await api.post("/v1/financial-reports/ubl/settlements/preview", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.data as UblSettlementPreview;
  },
  async importSettlement(file: File, mapping: ColumnMapping, opts: { sheet?: string; header_row?: number } = {}) {
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    if (opts.sheet) form.append("sheet", opts.sheet);
    if (opts.header_row) form.append("header_row", String(opts.header_row));
    const res = await api.post("/v1/financial-reports/ubl/settlements", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.data as UblSettlementImport;
  },
  async deleteSettlement(id: number) {
    await api.delete(`/v1/financial-reports/ubl/settlements/${id}`);
  },
};
