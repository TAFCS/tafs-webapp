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
    Settings2 as SettingsIcon,
    X
} from "lucide-react";
import { useRef } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchSections } from "@/store/slices/sectionsSlice";
import dynamic from "next/dynamic";
const PDFDownloadLink = dynamic(
    () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
    { ssr: false }
);
import { FeeChallanPDF } from "@/components/fees/FeeChallanPDF";
import { bankAccountsService, BankAccount } from "@/lib/bank-accounts.service";

// --- Types ---
interface StudentProfile {
    cc: number;
    student_full_name: string;
    gr_number: string;
    campus: string;
    class_id: number;
    grade_and_section: string;
    campus_id?: number;
    section_id?: number;
}

interface StudentFee {
    id: number;
    fee_type_id: number;
    amount: number;
    month: number;
    due_date: string;
    status: boolean;
    fee_types?: {
        id: number;
        description: string;
        freq: string;
    };
}

const MONTH_TO_NUM: Record<string, number> = {
    August: 8, September: 9, October: 10, November: 11, December: 12,
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7,
};

const MONTHS = [
    "August", "September", "October", "November", "December",
    "January", "February", "March", "April", "May", "June", "July"
];



export default function FeeChallanGenerator() {
    const dispatch = useDispatch<AppDispatch>();

    // --- Form States ---
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ cc: number; full_name: string; gr_number: string }[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchDropdownRef = useRef<HTMLDivElement>(null);

    const classes = useSelector((state: RootState) => state.classes.items);
    const sections = useSelector((state: RootState) => state.sections.items);

    const [student, setStudent] = useState<StudentProfile | null>(null);

    const [month, setMonth] = useState(MONTHS[new Date().getMonth() === 0 ? 5 : (new Date().getMonth() >= 8 ? new Date().getMonth() - 8 : new Date().getMonth() + 4)]);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState("");
    const [validityDate, setValidityDate] = useState("");

    // --- Bank States ---
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [isBanksLoading, setIsBanksLoading] = useState(true);
    const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);

    // Editable Bank Fields
    const [accTitle, setAccTitle] = useState("");
    const [accNo, setAccNo] = useState("");
    const [branchCode, setBranchCode] = useState("");
    const [bankAddress, setBankAddress] = useState("");
    const [iban, setIban] = useState("");


    const [applyLateFee, setApplyLateFee] = useState(false);

    // --- Fees States ---
    const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
    const [isFetchingFees, setIsFetchingFees] = useState(false);
    const [voucherSaved, setVoucherSaved] = useState(false);
    const [isSavingVoucher, setIsSavingVoucher] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        fetchBanks();
        dispatch(fetchClasses());
        dispatch(fetchSections());

        const handleClickOutside = (e: MouseEvent) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Search effect
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const { data } = await api.get(`/v1/students/search-simple?q=${searchQuery}`);
                setSearchResults(data?.data || []);
                setShowSearchDropdown(true);
            } catch (err) {
                console.error("Search failed:", err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch Fees Effect
    useEffect(() => {
        setVoucherSaved(false);
        setStudentFees([]);

        if (student && month) {
            fetchStudentFees(student.cc, month);
        }
    }, [student, month]);

    const fetchStudentFees = async (cc: number, selectedMonth: string) => {
        setIsFetchingFees(true);
        try {
            const { data } = await api.get(`/v1/student-fees/by-student/${cc}`);
            const allFees: StudentFee[] = data?.data || [];

            const monthNum = MONTH_TO_NUM[selectedMonth];
            const applicableFees = allFees.filter(f => f.month === monthNum);

            setStudentFees(applicableFees);
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch applicable fees.");
        } finally {
            setIsFetchingFees(false);
        }
    };

    const fetchBanks = async () => {
        setIsBanksLoading(true);
        try {
            const data = await bankAccountsService.getAll();
            setBanks(data);
            if (data.length > 0) {
                selectBank(data[0]);
            }
        } catch (err) {
            toast.error("Failed to load bank accounts");
        } finally {
            setIsBanksLoading(false);
        }
    };

    const selectBank = (bank: BankAccount) => {
        setSelectedBank(bank);
        setAccTitle(bank.account_title);
        setAccNo(bank.account_number);
        setBranchCode(bank.branch_code || "");
        setBankAddress(bank.bank_address || "");
        setIban(bank.iban || "");
    };

    // Default dates logic
    useEffect(() => {
        const d = new Date();
        const next10 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 10);
        const next15 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 15);
        if (!dueDate) setDueDate(next10.toISOString().split('T')[0]);
        if (!validityDate) setValidityDate(next15.toISOString().split('T')[0]);
    }, [dueDate, validityDate]);

    const handleSelectStudent = async (studentBrief: { cc: number; full_name: string; gr_number: string }) => {
        setIsSearching(true);
        try {
            const { data } = await api.get(`/v1/students/${studentBrief.cc}`);
            const foundStudent = data?.data;

            if (foundStudent) {
                setStudent(foundStudent);
                setSearchQuery("");
                setShowSearchDropdown(false);
                toast.success(`Student ${foundStudent.student_full_name || foundStudent.full_name} found!`);
            } else {
                toast.error("Student not found.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load student details.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSaveVoucher = async () => {
        if (!student || !selectedBank) {
            toast.error("Please select a student and a bank.");
            return;
        }
        if (studentFees.length === 0) {
            toast.error("No applicable fees found to generate a voucher.");
            return;
        }

        setIsSavingVoucher(true);
        try {
            const payload = {
                student_id: Number(student.cc),
                campus_id: Number(student.campus_id) || 1, // Fallback if missing
                class_id: Number(student.class_id) || 1,
                section_id: student.section_id ? Number(student.section_id) : null,
                bank_account_id: selectedBank.id,
                issue_date: issueDate,
                due_date: dueDate,
            };

            // Add optional fields only if they are defined to avoid 400 errors from strict validation
            const fullPayload = {
                ...payload,
                ...(validityDate ? { validity_date: validityDate } : {}),
                late_fee_charge: applyLateFee
            };

            await api.post('/v1/vouchers', fullPayload);
            toast.success("Voucher saved successfully!");
            setVoucherSaved(true);
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.message || "Failed to save voucher.");
        } finally {
            setIsSavingVoucher(false);
        }
    };

    const totalFeesAmount = studentFees.reduce((sum, fee) => sum + Number(fee.amount), 0);
    const pdfFees = studentFees.map(f => ({
        description: f.fee_types?.description || 'Unknown Fee',
        amount: Number(f.amount)
    }));

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 mt-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <CreditCard className="h-8 w-8 text-primary" />
                        Fee Challan Generator
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium">Issue and manage student fee vouchers with custom validity.</p>
                </div>


            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Student Search & Selection */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm overflow-hidden p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                <UserSearch className="h-5 w-5 text-primary" />
                            </div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">1. Select Student</h2>
                        </div>

                        <div className="space-y-5">
                            <div className="relative" ref={searchDropdownRef}>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Search Student</label>
                                <div className="relative mt-2">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <input
                                        type="text"
                                        placeholder="Enter Name, CC ID, or GR Number..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full h-12 pl-12 pr-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                    />
                                    {isSearching && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        </div>
                                    )}
                                    {searchQuery && !isSearching && (
                                        <button
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {showSearchDropdown && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {searchResults.map((res) => (
                                                <button
                                                    key={res.cc}
                                                    onClick={() => handleSelectStudent(res)}
                                                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-b border-zinc-50 dark:border-zinc-900 last:border-0 text-left group"
                                                >
                                                    <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                        <UserCircle className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{res.full_name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-wider">CC: {res.cc}</span>
                                                            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">GR: {res.gr_number}</span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Student Profile Preview */}
                        {student ? (
                            <div className="mt-8 p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden">
                                        <UserCircle className="h-10 w-10 text-zinc-200" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-black text-zinc-900 dark:text-zinc-100 text-base leading-tight">
                                            {student.student_full_name}
                                        </h3>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold mt-0.5 flex items-center gap-1.5 uppercase tracking-wide">
                                            <Building2 className="h-3 w-3" /> {student.campus || "Main Campus"}
                                        </p>

                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <span className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                                {classes.find(c => c.id === student.class_id)?.description || "Unknown Class"} {student.section_id ? `- ${sections.find(s => s.id === student.section_id)?.description || ""}` : ""}
                                            </span>
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
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-full">
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
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-zinc-100">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <SettingsIcon className="h-5 w-5 text-primary" />
                                </div>
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">2. Define Parameters</h2>
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
                                        className="w-full h-12 pl-5 pr-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all appearance-none cursor-pointer"
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
                                        value={selectedBank?.id ?? ""}
                                        onChange={(e) => {
                                            const b = banks.find(x => x.id === Number(e.target.value));
                                            if (b) selectBank(b);
                                        }}
                                        disabled={isBanksLoading || banks.length === 0}
                                        className="w-full h-12 pl-12 pr-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all appearance-none cursor-pointer disabled:opacity-50"
                                    >
                                        {isBanksLoading ? (
                                            <option>Loading banks...</option>
                                        ) : banks.length === 0 ? (
                                            <option>No banks configured</option>
                                        ) : (
                                            banks.map(b => <option key={b.id} value={b.id}>{b.bank_name}</option>)
                                        )}
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
                                        className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
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
                                        className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
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
                                        className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-rose-600 focus:text-zinc-900 dark:text-zinc-100"
                                    />
                                </div>
                            </div>

                            {/* Late Fee Toggle */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Surcharge (Late Fee)</label>
                                <div className="flex h-12 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl">
                                    <button
                                        onClick={() => setApplyLateFee(true)}
                                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${applyLateFee ? "bg-white dark:bg-zinc-950 text-rose-600 shadow-sm" : "text-zinc-400"}`}
                                    >
                                        YES
                                    </button>
                                    <button
                                        onClick={() => setApplyLateFee(false)}
                                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${!applyLateFee ? "bg-white dark:bg-zinc-950 text-emerald-600 shadow-sm" : "text-zinc-400"}`}
                                    >
                                        NO
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 3. Applicable Fees Display */}
                        <div className="p-8 border-t border-zinc-100">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <h2 className="text-lg font-bold text-zinc-900">3. Applicable Fees</h2>
                            </div>

                            {isFetchingFees ? (
                                <div className="py-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                                    <p className="text-sm font-bold text-zinc-500">Loading fees...</p>
                                </div>
                            ) : studentFees.length > 0 ? (
                                <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-zinc-50 border-b border-zinc-200">
                                            <tr>
                                                <th className="px-5 py-3 font-bold text-zinc-600">Fee Description</th>
                                                <th className="px-5 py-3 font-bold text-zinc-600 text-right">Amount (PKR)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {studentFees.map(fee => (
                                                <tr key={fee.id}>
                                                    <td className="px-5 py-3 font-medium text-zinc-900">{fee.fee_types?.description || 'Unknown Fee'}</td>
                                                    <td className="px-5 py-3 font-bold text-zinc-900 text-right">{Number(fee.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                            {applyLateFee && (
                                                <tr>
                                                    <td className="px-5 py-3 font-medium text-zinc-900">Late Payment Surcharge</td>
                                                    <td className="px-5 py-3 font-bold text-zinc-900 text-right">500.00</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-zinc-50 border-t border-zinc-200">
                                            <tr>
                                                <td className="px-5 py-4 font-black tracking-wider text-zinc-900 text-[11px] uppercase">NET PAYABLE AMOUNT</td>
                                                <td className="px-5 py-4 font-black text-primary text-right text-base">
                                                    {(totalFeesAmount + (applyLateFee ? 500 : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : student ? (
                                <div className="py-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50">
                                    <FileText className="h-8 w-8 text-zinc-300 mb-3" />
                                    <p className="text-sm font-bold text-zinc-500">No applicable fees found for {month}.</p>
                                </div>
                            ) : (
                                <div className="py-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50">
                                    <UserSearch className="h-8 w-8 text-zinc-300 mb-3" />
                                    <p className="text-sm font-bold text-zinc-500">Select a student first.</p>
                                </div>
                            )}
                        </div>

                        {/* Summary & Action */}
                        <div className="p-8 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                                    <AlertCircle className="h-5 w-5 text-amber-500" />
                                </div>
                                <div className="max-w-[280px]">
                                    <p className="text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-tight">System Notice</p>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">Generated challans are stored in the database for financial tracking. Ensure validity periods align with campus policy.</p>
                                </div>
                            </div>

                            {isClient && student && selectedBank && studentFees.length > 0 ? (
                                voucherSaved ? (
                                    <PDFDownloadLink
                                        document={
                                            <FeeChallanPDF
                                                student={{
                                                    cc: student.cc,
                                                    student_full_name: student.student_full_name,
                                                    gr_number: student.gr_number,
                                                    campus: student.campus,
                                                    class_id: student.class_id,
                                                    section_id: student.section_id,
                                                    className: classes.find(c => c.id === student.class_id)?.description || "Unknown",
                                                    sectionName: sections.find(s => s.id === student.section_id)?.description || "N/A",
                                                    grade_and_section: student.grade_and_section
                                                }}
                                                details={{
                                                    month,
                                                    issueDate,
                                                    dueDate,
                                                    validityDate,
                                                    applyLateFee,
                                                    bank: {
                                                        name: selectedBank.bank_name,
                                                        title: accTitle,
                                                        account: accNo,
                                                        branch: branchCode,
                                                        address: bankAddress,
                                                        iban: iban
                                                    }
                                                }}
                                                fees={pdfFees}
                                                totalAmount={totalFeesAmount}
                                            />
                                        }
                                        fileName={`Challan_${student.cc}_${month}.pdf`}
                                        className="w-full md:w-auto h-14 px-12 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-xl shadow-emerald-600/20 group"
                                    >
                                        {({ loading }) => (
                                            <>
                                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 group-hover:translate-y-1 transition-transform" />}
                                                {loading ? "Preparing..." : "Download PDF"}
                                            </>
                                        )}
                                    </PDFDownloadLink>
                                ) : (
                                    <button
                                        onClick={handleSaveVoucher}
                                        disabled={isSavingVoucher}
                                        className="w-full md:w-auto h-14 px-12 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-xl shadow-zinc-200 disabled:opacity-50"
                                    >
                                        {isSavingVoucher ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                                        {isSavingVoucher ? "Saving..." : "Save Voucher"}
                                        <ArrowRight className="h-4 w-4 opacity-30" />
                                    </button>
                                )
                            ) : (
                                <button
                                    disabled
                                    className="w-full md:w-auto h-14 px-12 bg-zinc-300 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 cursor-not-allowed grayscale"
                                >
                                    <Printer className="h-4 w-4" />
                                    Save Voucher
                                    <ArrowRight className="h-4 w-4 opacity-30" />
                                </button>
                            )}
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

