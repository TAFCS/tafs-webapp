"use client";
import { useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { ScopeBlock, ScopeValue } from "./ScopeBlock";
import { getAcademicYears, getCurrentAcademicYear, MONTHS } from "@/lib/fee-utils";
import api from "@/lib/api";
import toast from "react-hot-toast";

const ACADEMIC_YEARS = getAcademicYears(1, 2);
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = MONTHS;

const sel = "w-full h-10 px-3 appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all cursor-pointer";
const inp = "w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all";
const label = "block text-[10px] font-bold text-zinc-500 mb-1.5";

function getCalYear(academicYear: string, month: number) {
    const start = parseInt(academicYear.split("-")[0]);
    return month >= 8 ? start : start + 1;
}

function isValidDay(year: number, month: number, day: number) {
    const d = new Date(year, month - 1, day);
    return d.getMonth() === month - 1;
}

export function TabDeleteRange() {
    const feeTypes = useAppSelector((s: any) => s.feeTypes.items);

    const [scope, setScope] = useState<ScopeValue>({ campusId: "", classId: "", sectionId: "" });
    const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
    const [startMonth, setStartMonth] = useState("");
    const [endMonth, setEndMonth] = useState("");
    const [day, setDay] = useState("");
    const [feeTypeId, setFeeTypeId] = useState("");

    const [rangePreview, setRangePreview] = useState<any>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);

    const startNum = Number(startMonth);
    const endNum = Number(endMonth);
    const dayNum = Number(day);
    const rangeError = startNum && endNum && endNum < startNum ? "End month must be ≥ Start month" : null;

    const localMonths = (() => {
        if (!startNum || !endNum || !dayNum || !academicYear) return [];
        const rows = [];
        for (let m = startNum; m <= endNum; m++) {
            const calYear = getCalYear(academicYear, m);
            const valid = isValidDay(calYear, m, dayNum);
            rows.push({ month: m, label: MONTH_LABELS[m - 1], calYear, valid, dateStr: valid ? `${calYear}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : null });
        }
        return rows;
    })();

    const validCount = localMonths.filter(m => m.valid).length;

    const handleCheckMatches = async () => {
        if (!scope.campusId || !startNum || !endNum || !dayNum || !!rangeError) return;
        setIsChecking(true);
        setRangePreview(null);
        try {
            const params: any = { campus_id: scope.campusId, academic_year: academicYear, start_month: startNum, end_month: endNum, day: dayNum };
            if (scope.classId) params.class_id = scope.classId;
            if (scope.sectionId) params.section_id = scope.sectionId;
            if (feeTypeId) params.fee_type_id = feeTypeId;
            const { data } = await api.get("/v1/student-fees/bulk-delete-range-preview", { params });
            setRangePreview(data?.data);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Check failed.");
        } finally {
            setIsChecking(false);
        }
    };

    const handleConfirm = async () => {
        const ids = rangePreview?.all_deletable_fee_ids ?? [];
        if (!ids.length) return;
        if (!confirm(`Delete ${ids.length} fee head(s) across ${validCount} months? This cannot be undone.`)) return;
        setIsConfirming(true);
        try {
            const { data } = await api.delete("/v1/student-fees/bulk-delete", { data: { student_fee_ids: ids } });
            const r = data?.data;
            setResult(r);
            toast.success(`${r?.deleted ?? 0} heads deleted. ${r?.blocked ?? 0} blocked.`);
            setRangePreview(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Delete failed.");
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="space-y-6">
            <ScopeBlock value={scope} onChange={(v) => { setScope(v); setRangePreview(null); }} />

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
                    <label className={label}>Fee Type Filter <span className="text-zinc-300">(optional)</span></label>
                    <div className="relative">
                        <select value={feeTypeId} onChange={e => setFeeTypeId(e.target.value)} className={sel}>
                            <option value="">All fee types</option>
                            {feeTypes.map((ft: any) => <option key={ft.id} value={ft.id}>{ft.description}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className={label}>Start Month <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={startMonth} onChange={e => { setStartMonth(e.target.value); setRangePreview(null); }} className={sel}>
                            <option value="">Select...</option>
                            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className={label}>End Month <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={endMonth} onChange={e => { setEndMonth(e.target.value); setRangePreview(null); }} className={`${sel} ${rangeError ? "border-rose-400" : ""}`}>
                            <option value="">Select...</option>
                            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                    {rangeError && <p className="text-[10px] text-rose-500 mt-1 ml-1">{rangeError}</p>}
                </div>

                <div className="col-span-2">
                    <label className={label}>Day of Month <span className="text-rose-500">*</span></label>
                    <input type="number" min={1} max={31} value={day} onChange={e => { setDay(e.target.value); setRangePreview(null); }} placeholder="1–31" className={`${inp} max-w-[160px]`} />
                </div>
            </div>

            {/* Local month validity table */}
            {localMonths.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Month Preview</p>
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-900">
                                <tr>
                                    <th className="p-2 text-left font-bold text-zinc-500">Month</th>
                                    <th className="p-2 text-left font-bold text-zinc-500">Date</th>
                                    <th className="p-2 text-left font-bold text-zinc-500">Matches</th>
                                </tr>
                            </thead>
                            <tbody>
                                {localMonths.map(m => {
                                    const rp = rangePreview?.months?.find((r: any) => r.month === m.month);
                                    return (
                                        <tr key={m.month} className={`border-t border-zinc-100 dark:border-zinc-800 ${!m.valid ? "opacity-40" : ""}`}>
                                            <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-300">{m.label} {m.calYear}</td>
                                            <td className="p-2 font-mono text-zinc-500">{m.dateStr ?? "—"}</td>
                                            <td className="p-2">
                                                {!m.valid
                                                    ? <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-400 rounded font-bold text-[9px] uppercase">Skipped</span>
                                                    : rp
                                                        ? <span className="text-[10px] text-zinc-600">
                                                            <b className="text-rose-600">{rp.can_delete}</b> deletable
                                                            {rp.blocked > 0 && <>, <b>{rp.blocked}</b> blocked</>}
                                                        </span>
                                                        : <span className="text-zinc-400 text-[10px]">Check matches →</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={handleCheckMatches}
                    disabled={isChecking || !scope.campusId || !startNum || !endNum || !dayNum || !!rangeError}
                    className="flex-1 h-10 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
                >
                    {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check Matches"}
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={isConfirming || !rangePreview || (rangePreview?.total_can_delete ?? 0) === 0}
                    className="flex-[2] h-10 bg-rose-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-rose-700 transition-all"
                >
                    {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {rangePreview ? `Delete ${rangePreview.total_can_delete} heads across ${validCount} months` : `Delete across ${validCount} months`}
                </button>
            </div>

            {result && (
                <div className="space-y-2">
                    <button onClick={() => setShowBreakdown(p => !p)} className="w-full flex items-center justify-between px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
                        <span className="text-sm text-rose-800 font-semibold">{result.deleted} deleted. {result.blocked} blocked.</span>
                        <ChevronRight className={`h-4 w-4 text-rose-600 transition-transform ${showBreakdown ? "rotate-90" : ""}`} />
                    </button>
                </div>
            )}
        </div>
    );
}
