"use client";

import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  ublReconciliationService,
  type ColumnMapping,
  type MappingField,
  type UblSettlementImport,
  type UblSettlementPreview,
} from "@/lib/ubl-reconciliation.service";
import { formatRs } from "../../_components/report-utils";

function apiMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return fallback;
}

/**
 * Upload a UBL settlement statement. UBL's format isn't fixed yet, so any CSV
 * or Excel works: the user says which column holds each field once, and the
 * next upload with the same columns is prefilled from it.
 */
export function SettlementUploadDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (imp: UblSettlementImport) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UblSettlementPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [sheet, setSheet] = useState<string | undefined>();
  const [headerRow, setHeaderRow] = useState<number | undefined>();
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<UblSettlementImport | null>(null);

  const read = async (f: File, opts: { sheet?: string; header_row?: number } = {}) => {
    setReading(true);
    setErrors([]);
    try {
      const p = await ublReconciliationService.previewSettlement(f, opts);
      setPreview(p);
      setMapping(p.suggested_mapping ?? {});
      setSheet(p.sheet);
      setHeaderRow(p.header_row);
    } catch (err) {
      setPreview(null);
      toast.error(apiMessage(err, "Could not read the file"));
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    if (!file || !preview) return;
    setImporting(true);
    setErrors([]);
    try {
      const imp = await ublReconciliationService.importSettlement(file, mapping, { sheet, header_row: headerRow });
      setResult(imp);
      onImported(imp);
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: unknown } } })?.response?.data;
      const list = Array.isArray(data?.errors) ? (data!.errors as string[]) : [];
      setErrors(list.length ? list : [apiMessage(err, "Import failed")]);
    } finally {
      setImporting(false);
    }
  };

  const required = (preview?.fields ?? []).filter((f) => f.required);
  const missing = required.filter((f) => !mapping[f.key]).map((f) => f.label);
  const noDate = preview != null && !mapping.transaction_date && !mapping.settlement_date;
  const mappedIndex = (key: MappingField) => (mapping[key] ? preview?.headers.indexOf(mapping[key]!) ?? -1 : -1);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50">Upload UBL settlement</h2>
              <p className="text-xs font-medium text-zinc-400 mt-0.5">
                CSV or Excel from UBL. Each line is matched to a TAFS payment by UBL&apos;s transaction id.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-auto space-y-5">
          {result ? (
            <div className="flex items-start gap-3 rounded-2xl p-4 border bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-bold">
                  Imported {result.row_count.toLocaleString()} lines, {formatRs(result.total_amount)}
                  {result.first_date ? `, ${result.first_date} to ${result.last_date}` : ""}.
                </p>
                {result.skipped_rows > 0 && (
                  <p>{result.skipped_rows} line(s) without a transaction id were left out (totals or footer rows).</p>
                )}
                {(result.already_imported_lines ?? 0) > 0 && (
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    {result.already_imported_lines} transaction id(s) were already in an earlier upload. If this file was
                    uploaded twice, remove one copy; otherwise they show as settled more than once.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-6 cursor-pointer hover:border-emerald-400 transition-colors">
                {reading ? <Loader2 className="h-6 w-6 animate-spin text-zinc-400" /> : <Upload className="h-6 w-6 text-zinc-400" />}
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  {file ? file.name : "Choose the settlement file"}
                </span>
                <span className="text-xs text-zinc-400">.csv, .xlsx or .xls, up to 10 MB</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setFile(f);
                    void read(f);
                  }}
                />
              </label>

              {preview && (
                <>
                  <div className="flex flex-wrap items-end gap-4">
                    {preview.sheets.length > 1 && (
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sheet</span>
                        <select
                          value={sheet}
                          onChange={(e) => file && void read(file, { sheet: e.target.value })}
                          className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold"
                        >
                          {preview.sheets.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Header row</span>
                      <input
                        type="number"
                        min={1}
                        value={headerRow ?? ""}
                        onChange={(e) => setHeaderRow(Number(e.target.value) || undefined)}
                        onBlur={() => file && headerRow && headerRow !== preview.header_row && void read(file, { sheet, header_row: headerRow })}
                        className="h-10 w-24 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold"
                      />
                    </label>
                    <p className="text-xs text-zinc-400 pb-2">
                      {preview.row_count.toLocaleString()} rows below the header.{" "}
                      {preview.mapping_source === "last_upload"
                        ? "Columns filled in from the last upload."
                        : "Columns guessed from the headers; check them."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {preview.fields.map((f) => (
                      <label key={f.key} className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                          {f.label} {f.required && <span className="text-rose-500">*</span>}
                        </span>
                        <select
                          value={mapping[f.key] ?? ""}
                          onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                          className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold"
                        >
                          <option value="">{f.required ? "Choose a column" : "Not in this file"}</option>
                          {preview.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  {noDate && (
                    <p className="text-xs font-semibold text-amber-600">
                      Choose the transaction date or the settlement date, so each line can be dated.
                    </p>
                  )}

                  <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50 dark:bg-zinc-900">
                        <tr>
                          {preview.headers.map((h, i) => {
                            const field = preview.fields.find((f) => mappedIndex(f.key) === i);
                            return (
                              <th key={`${h}-${i}`} className="px-3 py-2 text-left font-black text-zinc-500 whitespace-nowrap">
                                {h}
                                {field && (
                                  <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{field.label}</span>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample_rows.map((r, i) => (
                          <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                            {r.map((c, j) => (
                              <td key={j} className="px-3 py-1.5 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {errors.length > 0 && (
                <div className="rounded-2xl p-4 border bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-200 text-sm">
                  <p className="font-bold mb-1">Nothing was imported.</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {errors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}
                  </ul>
                  {errors.length > 12 && <p className="mt-1">and {errors.length - 12} more.</p>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
          {!result && missing.length > 0 && preview && (
            <span className="mr-auto text-xs font-semibold text-zinc-400">Still needed: {missing.join(", ")}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-[11px] font-bold text-zinc-600 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={submit}
              disabled={!preview || missing.length > 0 || noDate || importing || reading}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
