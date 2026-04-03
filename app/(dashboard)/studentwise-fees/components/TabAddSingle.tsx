"use client";
import { useState, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { ScopeBlock, ScopeValue } from "./ScopeBlock";
import { getAcademicYears, getCurrentAcademicYear, MONTHS, MONTH_TO_NUM } from "@/lib/fee-utils";
import api from "@/lib/api";
import toast from "react-hot-toast";

const ACADEMIC_YEARS = getAcademicYears(1, 2);
const MONTH_NAMES = MONTHS;

const sel = "w-full h-10 px-3 appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all cursor-pointer";
const inp = "w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all";
const label = "block text-[10px] font-bold text-zinc-500 mb-1.5";

export function TabAddSingle() {
    const feeTypes = useAppSelector((s: any) => s.feeTypes.items);

    const [scope, setScope] = useState<ScopeValue>({ campusId: "", classId: "", sectionId: "" });
    const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
    const [feeTypeId, setFeeTypeId] = useState("");
    const [month, setMonth] = useState("");
    const [feeDate, setFeeDate] = useState("");
    const [amount, setAmount] = useState("");

    const [isPreviewing, setIsPreviewing] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [checkedIds, setCheckedIds] = useState<number[]>([]);

    const [isConfirming, setIsConfirming] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Auto-fetch amount from class schedule when fee type + class are selected
    const handleFeeTypeChange = useCallback(async (ftId: string) => {
        setFeeTypeId(ftId);
        setAmount("");
        if (!ftId || !scope.classId || !scope.campusId) return;
        try {
            const { data } = await api.get("/v1/class-fee-schedule/by-class", {
                params: { class_id: scope.classId, campus_id: scope.campusId },
            });
            const rows: any[] = Array.isArray(data?.data) ? data.data : [];
            const match = rows.find((r: any) => r.fee_id === Number(ftId));
            if (match) setAmount(match.amount);
        } catch { /* leave blank if not found */ }
    }, [scope.classId, scope.campusId]);

    const handlePreview = async () => {
        if (!scope.campusId || !feeTypeId || !feeDate || !academicYear) {
            toast.error("Fill all required fields before previewing.");
            return;
        }
        setIsPreviewing(true);
        setPreviewData(null);
        setResult(null);
        try {
            const params: any = { campus_id: scope.campusId, academic_year: academicYear, fee_type_id: feeTypeId, fee_date: feeDate };
            if (scope.classId) params.class_id = scope.classId;
            if (scope.sectionId) params.section_id = scope.sectionId;
            const { data } = await api.get("/v1/student-fees/bulk-preview", { params });
            setPreviewData(data?.data);
            setCheckedIds(data?.data?.students?.filter((s: any) => s.status === "will_add").map((s: any) => s.student_id) ?? []);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Preview failed.");
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (!checkedIds.length) return;
        setIsConfirming(true);
        try {
            const { data } = await api.post("/v1/student-fees/bulk-add", {
                academic_year: academicYear,
                fee_type_id: Number(feeTypeId),
                month: MONTH_TO_NUM[month] || 1,
                fee_date: feeDate,
                amount: Number(amount),
                student_ids: checkedIds,
            });
            const r = data?.data;
            setResult(r);
            toast.success(`${r?.added ?? 0} heads added. ${r?.skipped ?? 0} skipped.`);
            setPreviewData(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Operation failed.");
        } finally {
            setIsConfirming(false);
        }
    };

    const toggleCheck = (id: number) =>
        setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const willAddRows = previewData?.students?.filter((s: any) => s.status === "will_add") ?? [];
    const existsRows = previewData?.students?.filter((s: any) => s.status === "already_exists") ?? [];

    return (
        <div className="space-y-6">
            <ScopeBlock value={scope} onChange={(v) => { setScope(v); setPreviewData(null); setFeeTypeId(""); }} />

            <div className="grid grid-cols-2 gap-4">
                {/* Academic Year */}
                <div>
                    <label className={label}>Academic Year <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={sel}>
                            {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                {/* Fee Type */}
                <div>
                    <label className={label}>Fee Type <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={feeTypeId} onChange={(e) => handleFeeTypeChange(e.target.value)} className={sel}>
                            <option value="">Select fee type...</option>
                            {feeTypes.map((ft: any) => (
                                <option key={ft.id} value={ft.id}>{ft.description} — {ft.freq}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                {/* Month */}
                <div>
                    <label className={label}>Month (billing period) <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={month} onChange={(e) => setMonth(e.target.value)} className={sel}>
                            <option value="">Select month...</option>
                            {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                {/* Fee Date */}
                <div>
                    <label className={label}>Fee Date <span className="text-rose-500">*</span></label>
                    <input type="date" value={feeDate} onChange={(e) => setFeeDate(e.target.value)} className={inp} />
                </div>

                {/* Amount */}
                <div className="col-span-2">
                    <label className={label}>Amount <span className="text-rose-500">*</span></label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount..." className={inp} />
                    {amount && <p className="text-[10px] text-zinc-400 mt-1 ml-1">PKR {Number(amount).toLocaleString()}</p>}
                </div>
            </div>

            <button
                onClick={handlePreview}
                disabled={isPreviewing || !scope.campusId || !feeTypeId || !feeDate || !month || !amount}
                className="w-full h-10 bg-zinc-900 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all"
            >
                {isPreviewing ? <><Loader2 className="h-4 w-4 animate-spin" /> Fetching students...</> : "Preview Students"}
            </button>

            {/* Preview Table */}
            {previewData && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] text-zinc-500 font-semibold">
                            <span className="text-emerald-600 font-black">{previewData.will_add} will be added</span>
                            {previewData.already_exists > 0 && <span className="text-zinc-400">, {previewData.already_exists} already exist (skipped)</span>}
                        </p>
                        <p className="text-[10px] text-zinc-400">{checkedIds.length} selected</p>
                    </div>

                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left font-bold text-zinc-500 w-8">
                                        <input 
                                            type="checkbox" 
                                            className="accent-primary"
                                            checked={willAddRows.length > 0 && checkedIds.length === willAddRows.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setCheckedIds(willAddRows.map((s: any) => s.student_id));
                                                } else {
                                                    setCheckedIds([]);
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="p-2 text-left font-bold text-zinc-500">Student</th>
                                    <th className="p-2 text-left font-bold text-zinc-500">GR#</th>
                                    <th className="p-2 text-left font-bold text-zinc-500">Class</th>
                                    <th className="p-2 text-left font-bold text-zinc-500">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.students.map((s: any) => (
                                    <tr key={s.student_id} className={`border-t border-zinc-100 dark:border-zinc-800 ${s.status === "already_exists" ? "opacity-40" : ""}`}>
                                        <td className="p-2">
                                            {s.status === "will_add" && (
                                                <input type="checkbox" checked={checkedIds.includes(s.student_id)} onChange={() => toggleCheck(s.student_id)} className="accent-primary" />
                                            )}
                                        </td>
                                        <td className="p-2 font-semibold text-zinc-800 dark:text-zinc-200">{s.full_name}</td>
                                        <td className="p-2 text-zinc-500">{s.gr_number}</td>
                                        <td className="p-2 text-zinc-500">{s.class} {s.section}</td>
                                        <td className="p-2">
                                            {s.status === "will_add"
                                                ? <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[9px] uppercase">Will Add</span>
                                                : <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-400 rounded-md font-bold text-[9px] uppercase">Exists</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={isConfirming || checkedIds.length === 0}
                        className="w-full h-10 bg-emerald-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all"
                    >
                        {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Add {checkedIds.length} heads
                    </button>
                </div>
            )}

            {result && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-800 font-semibold">{result.added} heads added. {result.skipped} skipped (already existed).</p>
                </div>
            )}
        </div>
    );
}
