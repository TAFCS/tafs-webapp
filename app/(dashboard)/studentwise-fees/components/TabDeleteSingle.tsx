"use client";
import { useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { ScopeBlock, ScopeValue } from "./ScopeBlock";
import { getAcademicYears, getCurrentAcademicYear } from "@/lib/fee-utils";
import api from "@/lib/api";
import toast from "react-hot-toast";

const ACADEMIC_YEARS = getAcademicYears(1, 2);
const sel = "w-full h-10 px-3 appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all cursor-pointer";
const inp = "w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all";
const label = "block text-[10px] font-bold text-zinc-500 mb-1.5";

export function TabDeleteSingle() {
    const feeTypes = useAppSelector((s: any) => s.feeTypes.items);

    const [scope, setScope] = useState<ScopeValue>({ campusId: "", classId: "", sectionId: "" });
    const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
    const [feeDate, setFeeDate] = useState("");
    const [feeTypeId, setFeeTypeId] = useState("");

    const [isPreviewing, setIsPreviewing] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [checkedIds, setCheckedIds] = useState<number[]>([]);
    const [isConfirming, setIsConfirming] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handlePreview = async () => {
        if (!scope.campusId || !feeDate || !academicYear) {
            toast.error("Campus, academic year and fee date are required.");
            return;
        }
        setIsPreviewing(true);
        setPreviewData(null);
        setResult(null);
        try {
            const params: any = { campus_id: scope.campusId, academic_year: academicYear, fee_date: feeDate };
            if (scope.classId) params.class_id = scope.classId;
            if (scope.sectionId) params.section_id = scope.sectionId;
            if (feeTypeId) params.fee_type_id = feeTypeId;

            const { data } = await api.get("/v1/student-fees/bulk-delete-preview", { params });
            setPreviewData(data?.data);
            setCheckedIds(data?.data?.rows?.filter((r: any) => r.status === "can_delete").map((r: any) => r.id) ?? []);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Preview failed.");
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (!checkedIds.length) return;
        if (!confirm(`Delete ${checkedIds.length} fee head(s)? This cannot be undone.`)) return;
        setIsConfirming(true);
        try {
            const { data } = await api.delete("/v1/student-fees/bulk-delete", { data: { student_fee_ids: checkedIds } });
            const r = data?.data;
            setResult(r);
            toast.success(`${r?.deleted ?? 0} heads deleted. ${r?.blocked ?? 0} blocked (vouchers).`);
            setPreviewData(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Delete failed.");
        } finally {
            setIsConfirming(false);
        }
    };

    const toggleCheck = (id: number) =>
        setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const canDeleteRows = previewData?.rows?.filter((r: any) => r.status === "can_delete") ?? [];
    const blockedRows = previewData?.rows?.filter((r: any) => r.status === "blocked") ?? [];

    return (
        <div className="space-y-6">
            <ScopeBlock value={scope} onChange={(v) => { setScope(v); setPreviewData(null); }} />

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={label}>Academic Year <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className={sel}>
                            {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className={label}>Fee Date <span className="text-rose-500">*</span></label>
                    <input type="date" value={feeDate} onChange={e => { setFeeDate(e.target.value); setPreviewData(null); }} className={inp} />
                </div>

                <div className="col-span-2">
                    <label className={label}>Fee Type Filter <span className="text-zinc-300">(optional — leave blank to target all types on this date)</span></label>
                    <div className="relative">
                        <select value={feeTypeId} onChange={e => setFeeTypeId(e.target.value)} className={sel}>
                            <option value="">All fee types</option>
                            {feeTypes.map((ft: any) => <option key={ft.id} value={ft.id}>{ft.description}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <button
                onClick={handlePreview}
                disabled={isPreviewing || !scope.campusId || !feeDate}
                className="w-full h-10 bg-zinc-900 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all"
            >
                {isPreviewing ? <><Loader2 className="h-4 w-4 animate-spin" /> Fetching...</> : "Preview Matches"}
            </button>

            {previewData && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] text-zinc-500 font-semibold">
                            <span className="text-rose-600 font-black">{previewData.can_delete} will be deleted</span>
                            {previewData.blocked > 0 && <span className="text-zinc-400"> · {previewData.blocked} blocked (vouchers exist)</span>}
                        </p>
                        <p className="text-[10px] text-zinc-400">{checkedIds.length} selected</p>
                    </div>

                    {previewData.total === 0 && (
                        <div className="py-6 text-center text-zinc-400 text-sm">No matching fee heads found for this date and scope.</div>
                    )}

                    {previewData.total > 0 && canDeleteRows.length === 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                            <p className="text-sm text-amber-800 font-semibold">Nothing to delete. All matched heads are attached to existing vouchers.</p>
                        </div>
                    )}

                    {previewData.total > 0 && (
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0">
                                    <tr>
                                        <th className="p-2 w-8 text-left">
                                            <input 
                                                type="checkbox" 
                                                className="accent-rose-500"
                                                checked={canDeleteRows.length > 0 && checkedIds.length === canDeleteRows.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setCheckedIds(canDeleteRows.map((r: any) => r.id));
                                                    } else {
                                                        setCheckedIds([]);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th className="p-2 text-left font-bold text-zinc-500">Student</th>
                                        <th className="p-2 text-left font-bold text-zinc-500">GR#</th>
                                        <th className="p-2 text-left font-bold text-zinc-500">Fee Type</th>
                                        <th className="p-2 text-right font-bold text-zinc-500">Amount</th>
                                        <th className="p-2 text-left font-bold text-zinc-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.rows.map((r: any) => (
                                        <tr key={r.id} className={`border-t border-zinc-100 dark:border-zinc-800 ${r.status === "blocked" ? "opacity-50" : ""}`}>
                                            <td className="p-2">
                                                {r.status === "can_delete" && (
                                                    <input type="checkbox" checked={checkedIds.includes(r.id)} onChange={() => toggleCheck(r.id)} className="accent-rose-500" />
                                                )}
                                            </td>
                                            <td className="p-2 font-semibold text-zinc-800 dark:text-zinc-200">{r.student_name}</td>
                                            <td className="p-2 text-zinc-500">{r.gr_number}</td>
                                            <td className="p-2 text-zinc-500">{r.fee_type}</td>
                                            <td className="p-2 text-right font-mono text-zinc-700">PKR {Number(r.amount).toLocaleString()}</td>
                                            <td className="p-2">
                                                {r.status === "can_delete"
                                                    ? <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold text-[9px] uppercase">Can Delete</span>
                                                    : <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded font-bold text-[9px] uppercase">Blocked · Voucher</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {canDeleteRows.length > 0 && (
                        <button
                            onClick={handleConfirm}
                            disabled={isConfirming || checkedIds.length === 0}
                            className="w-full h-10 bg-rose-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-rose-700 transition-all"
                        >
                            {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete {checkedIds.length} heads
                        </button>
                    )}
                </div>
            )}

            {result && (
                <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <Trash2 className="h-5 w-5 text-rose-600 shrink-0" />
                    <p className="text-sm text-rose-800 font-semibold">{result.deleted} heads deleted. {result.blocked} blocked (vouchers still exist).</p>
                </div>
            )}
        </div>
    );
}
