"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Search,
    Loader2,
    Calendar,
    Building2,
    CreditCard,
    FileText,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Printer,
    Download,
    UserCircle,
    UserSearch,
    ChevronDown,
    Settings2 as SettingsIcon
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

// --- Types ---
interface StudentProfile {
    cc: number;
    student_full_name: string;
    gr_number: string;
    campus: string;
    class_id: number;
    grade_and_section: string;
}

const MONTHS = [
    "August", "September", "October", "November", "December",
    "January", "February", "March", "April", "May", "June", "July"
];

const BANKS = [
    "Meezan Bank Limited",
    "Habib Bank Limited (HBL)",
    "Bank Al-Falah",
    "United Bank Limited (UBL)",
    "Faysal Bank"
];

export default function FeeChallanGenerator() {
    // --- Form States ---
    const [searchCC, setSearchCC] = useState("");
    const [searchGR, setSearchGR] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [student, setStudent] = useState<StudentProfile | null>(null);

    const [month, setMonth] = useState(MONTHS[new Date().getMonth() === 0 ? 5 : (new Date().getMonth() >= 8 ? new Date().getMonth() - 8 : new Date().getMonth() + 4)]);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState("");
    const [validityDate, setValidityDate] = useState("");
    const [selectedBank, setSelectedBank] = useState(BANKS[0]);
    const [applyLateFee, setApplyLateFee] = useState(false);

    const [isGenerating, setIsGenerating] = useState(false);

    // Default dates logic
    useEffect(() => {
        const d = new Date();
        const next10 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 10);
        const next15 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 15);
        if (!dueDate) setDueDate(next10.toISOString().split('T')[0]);
        if (!validityDate) setValidityDate(next15.toISOString().split('T')[0]);
    }, [dueDate, validityDate]);

    const handleSearch = async () => {
        if (!searchCC && !searchGR) {
            toast.error("Please enter a CC or GR number.");
            return;
        }
        setIsSearching(true);
        setStudent(null);
        try {
            let foundStudent = null;
            if (searchCC) {
                const id = parseInt(searchCC.match(/\d+$/)?.[0] || searchCC);
                const { data } = await api.get(`/v1/students/${id}`);
                foundStudent = data?.data;
            } else {
                const { data } = await api.get("/v1/students", { params: { search: searchGR, limit: 1 } });
                foundStudent = data?.data?.items?.[0];
            }

            if (foundStudent) {
                setStudent(foundStudent);
                setSearchCC(`CC-${foundStudent.cc_number || foundStudent.cc}`);
                setSearchGR(foundStudent.gr_number || "");
                toast.success(`Student ${foundStudent.student_full_name || foundStudent.full_name} found!`);
            } else {
                toast.error("Student not found.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Search failed.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleGenerate = async () => {
        if (!student) {
            toast.error("Please search and select a student first.");
            return;
        }
        setIsGenerating(true);
        try {
            // Mock API call for challan generation
            await new Promise(r => setTimeout(r, 1500));
            toast.success("Fee challan generated successfully!");
            // In a real app, this might redirect to a PDF or open a print window
        } catch (e) {
            toast.error("Failed to generate challan.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 mt-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
                        <CreditCard className="h-8 w-8 text-primary" />
                        Fee Challan Generator
                    </h1>
                    <p className="text-zinc-500 mt-1.5 font-medium">Issue and manage student fee vouchers with custom validity.</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-zinc-200 shadow-sm">
                    <button className="px-5 py-2.5 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-all flex items-center gap-2">
                        <Download className="h-3.5 w-3.5" /> Bulk Generate
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Student Search & Selection */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white border border-zinc-200 rounded-[32px] shadow-sm overflow-hidden p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                <UserSearch className="h-5 w-5 text-primary" />
                            </div>
                            <h2 className="text-lg font-bold text-zinc-900">1. Select Student</h2>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">CC ID</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. CC-2026-001"
                                        value={searchCC}
                                        onChange={(e) => setSearchCC(e.target.value)}
                                        className="w-full h-12 px-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">GR Number</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 5421"
                                        value={searchGR}
                                        onChange={(e) => setSearchGR(e.target.value)}
                                        className="w-full h-12 px-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSearch}
                                disabled={isSearching}
                                className="w-full h-12 bg-zinc-900 text-white rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                Search Profile
                            </button>
                        </div>

                        {/* Student Profile Preview */}
                        {student ? (
                            <div className="mt-8 p-6 bg-zinc-50 border border-zinc-200 rounded-[24px] animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-center overflow-hidden">
                                        <UserCircle className="h-10 w-10 text-zinc-200" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-black text-zinc-900 text-base leading-tight">
                                            {student.student_full_name}
                                        </h3>
                                        <p className="text-zinc-500 text-xs font-bold mt-0.5 flex items-center gap-1.5 uppercase tracking-wide">
                                            <Building2 className="h-3 w-3" /> {student.campus || "Main Campus"}
                                        </p>

                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <span className="px-2.5 py-1 bg-zinc-200 text-zinc-600 rounded-lg text-[10px] font-black uppercase tracking-wider">{student.grade_and_section || "O-I"}</span>
                                            <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-wider">CC: {student.cc}</span>
                                        </div>
                                    </div>
                                    <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-8 py-10 border-2 border-dashed border-zinc-100 rounded-[28px] flex flex-col items-center justify-center gap-3">
                                <div className="p-3 bg-zinc-50 rounded-full">
                                    <FileText className="h-6 w-6 text-zinc-300" />
                                </div>
                                <p className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">No student selected</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Stats/History */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-[28px] p-6 flex items-center gap-4">
                        <div className="h-12 w-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-emerald-900 font-black text-sm uppercase tracking-tight">Active Invoicing</p>
                            <p className="text-emerald-700/70 text-xs font-medium italic">Standard fee structure will be applied.</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Challan Details Form */}
                <div className="lg:col-span-7">
                    <div className="bg-white border border-zinc-200 rounded-[32px] shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-zinc-100">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <SettingsIcon className="h-5 w-5 text-primary" />
                                </div>
                                <h2 className="text-lg font-bold text-zinc-900">2. Define Parameters</h2>
                            </div>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Month Select */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Fee Month</label>
                                <div className="relative">
                                    <select
                                        value={month}
                                        onChange={(e) => setMonth(e.target.value)}
                                        className="w-full h-12 pl-5 pr-12 bg-zinc-50 border border-zinc-200 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all appearance-none cursor-pointer"
                                    >
                                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Bank Select */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Collection Bank</label>
                                <div className="relative">
                                    <select
                                        value={selectedBank}
                                        onChange={(e) => setSelectedBank(e.target.value)}
                                        className="w-full h-12 pl-12 pr-12 bg-zinc-50 border border-zinc-200 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all appearance-none cursor-pointer"
                                    >
                                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Issue Date */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Date of Issue</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={issueDate}
                                        onChange={(e) => setIssueDate(e.target.value)}
                                        className="w-full h-12 px-5 bg-zinc-50 border border-zinc-200 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Due Date */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Due Date</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full h-12 px-5 bg-zinc-50 border border-zinc-200 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Validity Date */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Valid Till</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={validityDate}
                                        onChange={(e) => setValidityDate(e.target.value)}
                                        className="w-full h-12 px-5 bg-zinc-50 border border-zinc-200 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-rose-600 focus:text-zinc-900"
                                    />
                                </div>
                            </div>

                            {/* Late Fee Toggle */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Surcharge (Late Fee)</label>
                                <div className="flex h-12 bg-zinc-100 p-1 rounded-2xl">
                                    <button
                                        onClick={() => setApplyLateFee(true)}
                                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${applyLateFee ? "bg-white text-rose-600 shadow-sm" : "text-zinc-400"}`}
                                    >
                                        YES
                                    </button>
                                    <button
                                        onClick={() => setApplyLateFee(false)}
                                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${!applyLateFee ? "bg-white text-emerald-600 shadow-sm" : "text-zinc-400"}`}
                                    >
                                        NO
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Summary & Action */}
                        <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                                    <AlertCircle className="h-5 w-5 text-amber-500" />
                                </div>
                                <div className="max-w-[280px]">
                                    <p className="text-zinc-900 font-bold text-xs uppercase tracking-tight">System Notice</p>
                                    <p className="text-zinc-500 text-[11px] leading-relaxed">Generated challans are stored in the database for financial tracking. Ensure validity periods align with campus policy.</p>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !student}
                                className="w-full md:w-auto h-14 px-12 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-30 disabled:grayscale group shadow-xl shadow-zinc-200"
                            >
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 group-hover:scale-110 transition-transform" />}
                                Generate & Print
                                <ArrowRight className="h-4 w-4 opacity-30 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Design Tokens - Floating Indicator */}
            <div className="fixed bottom-6 right-6 z-50">
                <div className="bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Ready to Voucherize</span>
                </div>
            </div>
        </div>
    );
}

