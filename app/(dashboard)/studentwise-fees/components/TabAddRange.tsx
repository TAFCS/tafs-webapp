"use client";
import { useState, useEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import { ScopeBlock, ScopeValue } from "./ScopeBlock";
import { getAcademicYears, getCurrentAcademicYear, MONTHS, MONTH_TO_NUM } from "@/lib/fee-utils";
import api from "@/lib/api";
import toast from "react-hot-toast";

const ACADEMIC_YEARS = getAcademicYears(1, 2);
const MONTH_NAMES = MONTHS;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export function TabAddRange() {
    const feeTypes = useAppSelector((s: any) => s.feeTypes.items);

    const [scope, setScope] = useState<ScopeValue>({ campusId: "", classId: "", sectionId: "" });
    const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
    const [feeTypeId, setFeeTypeId] = useState("");
    const [startMonth, setStartMonth] = useState("");
    const [endMonth, setEndMonth] = useState("");
    const [day, setDay] = useState("");
    const [amount, setAmount] = useState("");

    const [conflictData, setConflictData] = useState<any>(null);
    const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);

    const startNum = Number(startMonth);
    const endNum = Number(endMonth);
    const dayNum = Number(day);

    // Academic index (Aug=0...July=11)
    const getAcademicIndex = (m: number) => (m >= 8 ? m - 8 : m + 4);

    let rangeError = null;
    if (startNum && endNum) {
        if (getAcademicIndex(endNum) < getAcademicIndex(startNum)) {
            rangeError = "End month must be after Start month (in Aug-July sequence)";
        }
    }

    // Local month validity preview
    const localMonths = (() => {
        if (!startNum || !endNum || !dayNum || !academicYear || rangeError) return [];
        const rows = [];
        const ACADEMIC_ORDER = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
        const startIndex = ACADEMIC_ORDER.indexOf(startNum);
        const endIndex = ACADEMIC_ORDER.indexOf(endNum);

        for (let i = startIndex; i <= endIndex; i++) {
            const m = ACADEMIC_ORDER[i];
            const calYear = getCalYear(academicYear, m);
            const valid = isValidDay(calYear, m, dayNum);
            const dateStr = valid ? `${calYear}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : null;
            rows.push({ month: m, label: MONTH_LABELS[m - 1], calYear, valid, dateStr, reason: valid ? null : `Day ${dayNum} doesn't exist in ${MONTH_LABELS[m - 1]}` });
        }
        return rows;
    })();

    const validCount = localMonths.filter(m => m.valid).length;
    const canCheckConflicts = !!scope.campusId && !!feeTypeId && validCount > 0;
    const canConfirm = canCheckConflicts && !!amount && !rangeError;

    const handleCheckConflicts = async () => {
        setIsCheckingConflicts(true);
        setConflictData(null);
        try {
            const params: any = {
                campus_id: scope.campusId,
                academic_year: academicYear,
                fee_type_id: feeTypeId,
                start_month: startNum,
                end_month: endNum,
                day: dayNum,
            };
            if (scope.classId) params.class_id = scope.classId;
            if (scope.sectionId) params.section_id = scope.sectionId;
            const { data } = await api.get("/v1/student-fees/bulk-add-range-conflicts", { params });
            setConflictData(data?.data);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Conflict check failed.");
        } finally {
            setIsCheckingConflicts(false);
        }
    };

    const handleConfirm = async () => {
        setIsConfirming(true);
        setResult(null);
        try {
            const { data } = await api.post("/v1/student-fees/bulk-add-range", {
                academic_year: academicYear,
                fee_type_id: Number(feeTypeId),
                start_month: startNum,
                end_month: endNum,
                day: dayNum,
                amount: Number(amount),
                student_ids: conflictData?.months
                    ?.filter((m: any) => m.valid && m.will_add > 0)
                    ?.flatMap(() => []) || [],
                // We need actual student IDs — fetch scope students first
            });
            const r = data?.data;
            setResult(r);
            toast.success(`${r?.total_added ?? 0} heads added across ${validCount} months.`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Operation failed.");
        } finally {
            setIsConfirming(false);
        }
    };

    // For the actual confirm we need student IDs from scope
    const handleConfirmWithStudents = async () => {
        setIsConfirming(true);
        setResult(null);
        try {
            // Get student IDs in scope via preview with a dummy fee_date (just to list students)
            // Better: use first valid date
            const firstValid = localMonths.find(m => m.valid);
            if (!firstValid?.dateStr) { toast.error("No valid months found."); return; }

            const params: any = { campus_id: scope.campusId, academic_year: academicYear, fee_type_id: Number(feeTypeId), fee_date: firstValid.dateStr };
            if (scope.classId) params.class_id = scope.classId;
            if (scope.sectionId) params.section_id = scope.sectionId;

            // Get all students in scope (use bulk-preview to get IDs)
            const previewRes = await api.get("/v1/student-fees/bulk-preview", { params });
            const allStudentIds = previewRes.data?.data?.students?.map((s: any) => s.student_id) ?? [];

            const { data } = await api.post("/v1/student-fees/bulk-add-range", {
                academic_year: academicYear,
                fee_type_id: Number(feeTypeId),
                start_month: startNum,
                end_month: endNum,
                day: dayNum,
                amount: Number(amount),
                student_ids: allStudentIds,
            });
            const r = data?.data;
            setResult(r);
            toast.success(`${r?.total_added ?? 0} heads added across ${validCount} months.`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Operation failed.");
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="space-y-6">
            <ScopeBlock value={scope} onChange={(v) => { setScope(v); setConflictData(null); }} />

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
                    <label className={label}>Fee Type <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={feeTypeId} onChange={e => setFeeTypeId(e.target.value)} className={sel}>
                            <option value="">Select fee type...</option>
                            {feeTypes.map((ft: any) => <option key={ft.id} value={ft.id}>{ft.description} — {ft.freq}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className={label}>Start Month <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={startMonth} onChange={e => { setStartMonth(e.target.value); setConflictData(null); }} className={sel}>
                            <option value="">Select...</option>
                            {MONTH_NAMES.map((m) => (
                                <option key={m} value={MONTH_TO_NUM[m]}>{m}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className={label}>End Month <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select value={endMonth} onChange={e => { setEndMonth(e.target.value); setConflictData(null); }} className={`${sel} ${rangeError ? "border-rose-400" : ""}`}>
                            <option value="">Select...</option>
                            {MONTH_NAMES.map((m) => (
                                <option key={m} value={MONTH_TO_NUM[m]}>{m}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                    {rangeError && <p className="text-[10px] text-rose-500 mt-1 ml-1">{rangeError}</p>}
                </div>

                <div>
                    <label className={label}>Day of Month <span className="text-rose-500">*</span></label>
                    <input type="number" min={1} max={31} value={day} onChange={e => { setDay(e.target.value); setConflictData(null); }} placeholder="1–31" className={inp} />
                </div>

                <div>
                    <label className={label}>Amount <span className="text-rose-500">*</span></label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount..." className={inp} />
                </div>
            </div>

            {/* Local Month Validity Table */}
            {localMonths.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Month Preview</p>
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-900">
                                <tr>
                                    <th className="p-2 text-left font-bold text-zinc-500">Month</th>
                                    <th className="p-2 text-left font-bold text-zinc-500">Date</th>
                                    <th className="p-2 text-left font-bold text-zinc-500">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {localMonths.map(m => {
                                    const conflict = conflictData?.months?.find((c: any) => c.month === m.month && c.valid);
                                    return (
                                        <tr key={m.month} className={`border-t border-zinc-100 dark:border-zinc-800 ${!m.valid ? "opacity-40" : ""}`}>
                                            <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-300">{m.label} {m.calYear}</td>
                                            <td className="p-2 font-mono text-zinc-500">{m.dateStr ?? "—"}</td>
                                            <td className="p-2">
                                                {!m.valid
                                                    ? <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-400 rounded font-bold text-[9px] uppercase">Skipped — {m.reason}</span>
                                                    : conflict
                                                        ? <span className="text-[10px] text-zinc-600">Will add <b className="text-emerald-600">{conflict.will_add}</b>, skip <b>{conflict.existing}</b> (exist)</span>
                                                        : <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold text-[9px] uppercase">Valid</span>
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
                    onClick={handleCheckConflicts}
                    disabled={isCheckingConflicts || !canCheckConflicts || !!rangeError}
                    className="flex-1 h-10 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
                >
                    {isCheckingConflicts ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check Conflicts"}
                </button>
                <button
                    onClick={handleConfirmWithStudents}
                    disabled={isConfirming || !canConfirm || !!rangeError}
                    className="flex-[2] h-10 bg-emerald-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all"
                >
                    {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Generate heads across {validCount} months</>}
                </button>
            </div>

            {result && (
                <div className="space-y-2">
                    <button onClick={() => setShowBreakdown(p => !p)} className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <span className="text-sm text-emerald-800 font-semibold">{result.total_added} heads added. {result.total_skipped} skipped.</span>
                        <ChevronRight className={`h-4 w-4 text-emerald-600 transition-transform ${showBreakdown ? "rotate-90" : ""}`} />
                    </button>
                    {showBreakdown && (
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                            <table className="w-full text-xs">
                                <thead className="bg-zinc-50 dark:bg-zinc-900">
                                    <tr>
                                        <th className="p-2 text-left font-bold text-zinc-500">Month</th>
                                        <th className="p-2 text-left font-bold text-zinc-500">Added</th>
                                        <th className="p-2 text-left font-bold text-zinc-500">Skipped</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.summary?.map((s: any) => (
                                        <tr key={s.month} className="border-t border-zinc-100">
                                            <td className="p-2 font-semibold text-zinc-700">{MONTH_LABELS[(s.month ?? 1) - 1]}</td>
                                            <td className="p-2 text-emerald-600 font-bold">{s.added ?? "—"}</td>
                                            <td className="p-2 text-zinc-400">{s.skipped ?? (s.skipped_reason ? `Skipped (${s.skipped_reason})` : "—")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
