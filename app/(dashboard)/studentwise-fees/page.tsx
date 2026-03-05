"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { Search, Loader2, AlertCircle, GraduationCap, ChevronDown, X, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchClasses } from "@/store/slices/classesSlice";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeeTypeInfo {
    id: number;
    description: string;
    freq: "MONTHLY" | "ONE_TIME" | null;
    breakup: {
        months: string[];
    } | null;
}

interface ClassFeeRow {
    id: number;
    class_id: number;
    fee_id: number;
    amount: string;
    fee_types: FeeTypeInfo;
}

interface ExpandedRow {
    feeId: number;
    feeDescription: string;
    freq: "MONTHLY" | "ONE_TIME" | null;
    month: string;
    baseAmount: string;
    isGroupStart: boolean;
    groupSize: number;
}

const MONTH_ORDER = [
    "August", "September", "October", "November", "December",
    "January", "February", "March", "April", "May", "June", "July",
];

const COLS = ["#", "Fee Type", "Frequency", "Period", "Amount"] as const;
const COL_AMOUNT = 4; // only this column is editable

function sortMonths(months: string[] | null | undefined) {
    if (!Array.isArray(months)) return [];
    return [...months].sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StudentwiseFeePage() {
    const dispatch = useAppDispatch();
    const classes = useAppSelector((s) => s.classes.items);
    const classesLoading = useAppSelector((s) => s.classes.isLoading);

    const [selectedClassId, setSelectedClassId] = useState<number | "">("");
    const [classSearch, setClassSearch] = useState("");
    const [showClassDropdown, setShowClassDropdown] = useState(false);
    const classDropdownRef = useRef<HTMLDivElement>(null);
    const [studentId, setStudentId] = useState("");

    const [feeRows, setFeeRows] = useState<ClassFeeRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    // overrides: `${feeId}-${month}` -> string
    const [overrides, setOverrides] = useState<Record<string, string>>({});

    // Active cell: {row, col}
    const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
    const tbodyRef = useRef<HTMLTableSectionElement>(null);

    useEffect(() => { if (classes.length === 0) dispatch(fetchClasses()); }, [classes.length, dispatch]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node))
                setShowClassDropdown(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const fetchFeeSchedule = useCallback(async (classId: number) => {
        setIsLoading(true); setLoadError(null); setFeeRows([]); setOverrides({}); setActiveCell(null);
        try {
            const { data } = await api.get("/v1/class-fee-schedule/by-class", { params: { class_id: classId } });
            setFeeRows(Array.isArray(data?.data) ? data.data : []);
        } catch (err: any) {
            setLoadError(err.response?.data?.message || "Failed to load fee schedule.");
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        if (selectedClassId !== "") fetchFeeSchedule(Number(selectedClassId));
    }, [selectedClassId, fetchFeeSchedule]);

    // ── Sort: ONE_TIME first, then MONTHLY ────────────────────────────────
    const sortedFeeRows = [...feeRows].sort((a, b) => {
        const order = (f: ClassFeeRow) => f?.fee_types?.freq === "ONE_TIME" ? 0 : 1;
        return order(a) - order(b);
    });

    // ── Expand into flat row list ─────────────────────────────────────────
    const expandedRows: ExpandedRow[] = sortedFeeRows.flatMap((fee) => {
        const breakupMonths = fee?.fee_types?.breakup?.months;
        const months = sortMonths(breakupMonths);

        // If no breakup is defined, we show at least one row for the title
        if (months.length === 0) {
            return [{
                feeId: fee.fee_id,
                feeDescription: fee?.fee_types?.description || "Unknown Fee",
                freq: fee?.fee_types?.freq || null,
                month: "—", // No specific period
                baseAmount: fee.amount,
                isGroupStart: true,
                groupSize: 1,
            }];
        }

        return months.map((month, idx) => ({
            feeId: fee.fee_id,
            feeDescription: fee?.fee_types?.description || "Unknown Fee",
            freq: fee?.fee_types?.freq || null,
            month,
            baseAmount: fee.amount,
            isGroupStart: idx === 0,
            groupSize: months.length,
        }));
    });

    const totalRows = expandedRows.length;
    const totalCols = COLS.length;

    // ── Keyboard navigation ───────────────────────────────────────────────
    const navigate = useCallback((dr: number, dc: number) => {
        setActiveCell((prev) => {
            const r = prev ? Math.max(0, Math.min(totalRows - 1, prev.row + dr)) : 0;
            const c = prev ? Math.max(0, Math.min(totalCols - 1, prev.col + dc)) : COL_AMOUNT;
            return { row: r, col: c };
        });
    }, [totalRows, totalCols]);

    const handleTableKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
        if (!activeCell) return;
        // When in the amount input, only trap arrow up/down (left/right go inside input)
        if (activeCell.col === COL_AMOUNT) {
            if (e.key === "ArrowUp") { e.preventDefault(); navigate(-1, 0); }
            if (e.key === "ArrowDown") { e.preventDefault(); navigate(1, 0); }
            if (e.key === "Enter") { e.preventDefault(); navigate(1, 0); }
            if (e.key === "Tab") { e.preventDefault(); e.shiftKey ? navigate(0, -1) : navigate(0, 1); }
        } else {
            if (e.key === "ArrowUp") { e.preventDefault(); navigate(-1, 0); }
            if (e.key === "ArrowDown") { e.preventDefault(); navigate(1, 0); }
            if (e.key === "ArrowLeft") { e.preventDefault(); navigate(0, -1); }
            if (e.key === "ArrowRight") { e.preventDefault(); navigate(0, 1); }
            if (e.key === "Tab") { e.preventDefault(); e.shiftKey ? navigate(0, -1) : navigate(0, 1); }
            if (e.key === "Enter") { e.preventDefault(); navigate(0, 1); }
        }
    }, [activeCell, navigate]);

    // Focus input when landing on amount col
    useEffect(() => {
        if (!activeCell || activeCell.col !== COL_AMOUNT || !tbodyRef.current) return;
        const input = tbodyRef.current.querySelector<HTMLInputElement>(`[data-row="${activeCell.row}"][data-col="${COL_AMOUNT}"]`);
        input?.focus({ preventScroll: false });
        input?.scrollIntoView({ block: "nearest" });
    }, [activeCell]);

    // Focus cell div when on non-amount col
    useEffect(() => {
        if (!activeCell || activeCell.col === COL_AMOUNT || !tbodyRef.current) return;
        const el = tbodyRef.current.querySelector<HTMLElement>(`[data-row="${activeCell.row}"][data-col="${activeCell.col}"]`);
        el?.focus({ preventScroll: false });
        el?.scrollIntoView({ block: "nearest" });
    }, [activeCell]);

    const overrideKey = (feeId: number, month: string) => `${feeId}-${month}`;
    const getAmount = (row: ExpandedRow) => overrides[overrideKey(row.feeId, row.month)] ?? row.baseAmount;
    const isOverridden = (row: ExpandedRow) => {
        const k = overrideKey(row.feeId, row.month);
        return k in overrides && overrides[k] !== row.baseAmount;
    };
    const handleAmountChange = (feeId: number, month: string, value: string) =>
        setOverrides((p) => ({ ...p, [overrideKey(feeId, month)]: value }));

    const grandTotal = expandedRows.reduce((s, r) => s + parseFloat(getAmount(r) || "0"), 0);

    const selectedClass = classes.find((c) => c.id === Number(selectedClassId));
    const filteredClasses = classes.filter((c) =>
        c.description.toLowerCase().includes(classSearch.toLowerCase()) ||
        c.class_code.toLowerCase().includes(classSearch.toLowerCase())
    );

    // ── Spreadsheet cell wrapper ──────────────────────────────────────────
    const cellBase =
        "border-r border-b border-zinc-200 focus:outline-none select-none transition-colors";

    const isCellActive = (r: number, c: number) => activeCell?.row === r && activeCell?.col === c;
    const isRowActive = (r: number) => activeCell?.row === r;

    // ─── Render ──────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Studentwise Fee</h1>
                <p className="text-zinc-500 mt-1">Select a class to view its fee schedule broken down by fee type and period.</p>
            </div>

            {/* Class + Student Selector */}
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-end gap-4">
                {/* Class dropdown */}
                <div className="flex-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Select Class</label>
                    <div className="relative" ref={classDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setShowClassDropdown((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-left hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                            <span className={selectedClass ? "text-zinc-900 font-medium" : "text-zinc-400"}>
                                {selectedClass ? `${selectedClass.description} (${selectedClass.class_code})` : "Choose a class…"}
                            </span>
                            <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${showClassDropdown ? "rotate-180" : ""}`} />
                        </button>

                        {showClassDropdown && (
                            <div className="absolute z-50 top-full mt-1.5 w-full bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
                                <div className="p-2 border-b border-zinc-100">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                        <input autoFocus type="text" placeholder="Search class…" value={classSearch}
                                            onChange={(e) => setClassSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {classesLoading
                                        ? <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
                                        : filteredClasses.length === 0
                                            ? <div className="px-4 py-3 text-sm text-zinc-400">No classes found</div>
                                            : filteredClasses.map((c) => (
                                                <button key={c.id} type="button"
                                                    onClick={() => { setSelectedClassId(c.id); setShowClassDropdown(false); setClassSearch(""); }}
                                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-zinc-50 transition-colors text-left ${selectedClassId === c.id ? "bg-primary/5 text-primary font-medium" : "text-zinc-700"}`}
                                                >
                                                    <span>{c.description}</span>
                                                    <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-mono">{c.class_code}</span>
                                                </button>
                                            ))
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Student ID */}
                <div className="w-44">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                        Student ID
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. 10042"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                </div>

                {selectedClassId !== "" && (
                    <button onClick={() => fetchFeeSchedule(Number(selectedClassId))} disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-200 bg-white text-sm font-medium text-zinc-700 rounded-xl hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Refresh
                    </button>
                )}
            </div>

            {/* States */}
            {isLoading && (
                <div className="flex items-center justify-center py-20 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="text-sm text-zinc-500">Loading…</span>
                </div>
            )}
            {loadError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0" /><span>{loadError}</span>
                    <button onClick={() => setLoadError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
                </div>
            )}
            {!isLoading && !loadError && selectedClassId === "" && (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-3">
                    <div className="h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center">
                        <GraduationCap className="h-7 w-7 text-zinc-300" />
                    </div>
                    <p className="text-sm font-medium text-zinc-500">Select a class to load its fee schedule</p>
                </div>
            )}
            {!isLoading && !loadError && selectedClassId !== "" && feeRows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-2">
                    <AlertCircle className="h-6 w-6 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-600">No fee schedule for this class</p>
                </div>
            )}

            {/* ── Spreadsheet ─────────────────────────────────────────── */}
            {!isLoading && !loadError && expandedRows.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-700">{selectedClass?.description}</span>
                            <span>·</span>
                            <span>{feeRows.length} fee types · {expandedRows.length} line items</span>
                            <span>·</span>
                            <span className="text-zinc-400">Arrow keys to navigate · Enter / Tab to move</span>
                        </div>
                    </div>

                    {/* Spreadsheet wrapper */}
                    <div
                        className="border border-zinc-300 rounded-xl overflow-auto max-h-[70vh] shadow-sm bg-white"
                        onKeyDown={handleTableKeyDown}
                    >
                        <table className="w-full text-sm border-collapse">
                            {/* Column header row */}
                            <thead className="sticky top-0 z-20">
                                <tr>
                                    <th className="border-r border-b border-zinc-300 bg-zinc-100 px-3 py-3 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-10">
                                        #
                                    </th>
                                    <th className="border-r border-b border-zinc-300 bg-zinc-100 px-4 py-3 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider min-w-[180px]">
                                        Fee Type
                                    </th>
                                    <th className="border-r border-b border-zinc-300 bg-zinc-100 px-4 py-3 text-center text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-28">
                                        Frequency
                                    </th>
                                    <th className="border-r border-b border-zinc-300 bg-zinc-100 px-4 py-3 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-36">
                                        Period
                                    </th>
                                    <th className="border-b border-zinc-300 bg-zinc-100 px-4 py-3 text-right text-[11px] font-bold text-zinc-500 uppercase tracking-wider min-w-[160px]">
                                        Amount (Rs.)
                                    </th>
                                </tr>
                            </thead>

                            <tbody ref={tbodyRef}>
                                {expandedRows.map((row, rIdx) => {
                                    const overridden = isOverridden(row);
                                    const rowActive = isRowActive(rIdx);
                                    // thick top border at group start (except first row)
                                    const groupTop = row.isGroupStart && rIdx > 0 ? "border-t-2 border-t-zinc-400" : "";

                                    return (
                                        <tr
                                            key={`${row.feeId}-${row.month}`}
                                            className={`${groupTop} ${rowActive ? "bg-blue-50/60" : "bg-white hover:bg-zinc-50/40"}`}
                                        >
                                            {/* # */}
                                            <td
                                                data-row={rIdx} data-col={0}
                                                tabIndex={0}
                                                onFocus={() => setActiveCell({ row: rIdx, col: 0 })}
                                                onClick={() => setActiveCell({ row: rIdx, col: 0 })}
                                                className={`${cellBase} px-3 py-0 text-xs font-mono text-zinc-300 text-center h-10 cursor-cell
                                                    ${isCellActive(rIdx, 0) ? "ring-2 ring-inset ring-primary bg-white z-10" : ""}`}
                                            >
                                                {rIdx + 1}
                                            </td>

                                            {/* Fee Type */}
                                            <td
                                                data-row={rIdx} data-col={1}
                                                tabIndex={0}
                                                onFocus={() => setActiveCell({ row: rIdx, col: 1 })}
                                                onClick={() => setActiveCell({ row: rIdx, col: 1 })}
                                                className={`${cellBase} px-4 py-0 h-10 cursor-cell
                                                    ${isCellActive(rIdx, 1) ? "ring-2 ring-inset ring-primary bg-white z-10" : ""}`}
                                            >
                                                <span className="font-medium text-zinc-800">{row.feeDescription}</span>
                                            </td>

                                            {/* Frequency */}
                                            <td
                                                data-row={rIdx} data-col={2}
                                                tabIndex={0}
                                                onFocus={() => setActiveCell({ row: rIdx, col: 2 })}
                                                onClick={() => setActiveCell({ row: rIdx, col: 2 })}
                                                className={`${cellBase} px-4 py-0 h-10 text-center cursor-cell
                                                    ${isCellActive(rIdx, 2) ? "ring-2 ring-inset ring-primary bg-white z-10" : ""}`}
                                            >
                                                {row.isGroupStart && (
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${row.freq === "MONTHLY" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                                                        {row.freq === "MONTHLY" ? "Monthly" : "One-time"}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Period */}
                                            <td
                                                data-row={rIdx} data-col={3}
                                                tabIndex={0}
                                                onFocus={() => setActiveCell({ row: rIdx, col: 3 })}
                                                onClick={() => setActiveCell({ row: rIdx, col: 3 })}
                                                className={`${cellBase} px-4 py-0 h-10 cursor-cell
                                                    ${isCellActive(rIdx, 3) ? "ring-2 ring-inset ring-primary bg-white z-10" : ""}`}
                                            >
                                                <span className="text-zinc-600">{row.month}</span>
                                            </td>

                                            {/* Amount — editable */}
                                            <td className={`border-b border-zinc-200 p-0 h-10 ${isCellActive(rIdx, COL_AMOUNT) ? "z-10 relative" : ""}`}>
                                                <div className="relative h-full">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">
                                                        Rs.
                                                    </span>
                                                    <input
                                                        data-row={rIdx}
                                                        data-col={COL_AMOUNT}
                                                        type="number"
                                                        value={getAmount(row)}
                                                        onChange={(e) => handleAmountChange(row.feeId, row.month, e.target.value)}
                                                        onFocus={() => setActiveCell({ row: rIdx, col: COL_AMOUNT })}
                                                        onClick={() => setActiveCell({ row: rIdx, col: COL_AMOUNT })}
                                                        className={`w-full h-full pl-9 pr-4 text-right font-mono text-sm bg-transparent outline-none transition-all cursor-cell
                                                            ${isCellActive(rIdx, COL_AMOUNT) ? "ring-2 ring-inset ring-primary bg-white" : "hover:bg-zinc-50/60"}
                                                            ${overridden ? "text-primary font-semibold" : "text-zinc-700"}`}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>

                            {/* Grand total footer */}
                            <tfoot className="sticky bottom-0 z-20">
                                <tr className="bg-zinc-100 border-t-2 border-zinc-300">
                                    <td className="border-r border-zinc-300 px-3 py-3" colSpan={3}>
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Annual Grand Total</span>
                                    </td>
                                    <td className="border-r border-zinc-300 px-4 py-3 text-xs text-zinc-400">
                                        {expandedRows.length} items
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 text-base">
                                        Rs. {grandTotal.toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-blue-50 border border-primary/30 inline-block" />
                            Active row
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-white border-2 border-primary inline-block" />
                            Active cell
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="text-primary font-semibold">Rs. 0</span>
                            Overridden
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
