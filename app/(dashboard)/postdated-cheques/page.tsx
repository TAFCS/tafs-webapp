"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Loader2,
    Calendar,
    CreditCard,
    FileText,
    ArrowUpRight,
    CheckCircle2,
    AlertCircle,
    UserCircle,
    UserSearch,
    X,
    Plus,
    Filter,
    Clock,
    DollarSign,
    TrendingUp,
    Check,
    AlertTriangle,
    Undo,
    Trash2,
    Building,
    FileSignature,
    CheckSquare
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

interface StudentBrief {
    cc: number;
    full_name: string;
    gr_number: string;
    campus_id?: number;
    campuses?: { campus_name: string };
}

interface ChequeItem {
    id: number;
    cheque_number: string;
    bank_name: string | null;
    amount: number | string;
    cheque_date: string;
    received_date: string;
    received_by: string | null;
    status: "PENDING" | "CASHED" | "BOUNCED" | "RETURNED" | "CANCELLED";
    cashed_date: string | null;
    cashed_by: string | null;
    notes: string | null;
    created_at: string;
    students: {
        cc: number;
        full_name: string;
        campus_id: number;
    };
    received_by_user: { id: string; full_name: string } | null;
    cashed_by_user: { id: string; full_name: string } | null;
}

interface Campus {
    id: number;
    campus_name: string;
}

export default function PostdatedChequesPage() {
    const user = useSelector((state: RootState) => state.auth.user);

    // List and Loading States
    const [cheques, setCheques] = useState<ChequeItem[]>([]);
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Filters & Search
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [campusFilter, setCampusFilter] = useState<string>("");
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [selectedStudentFilter, setSelectedStudentFilter] = useState<StudentBrief | null>(null);
    const [fromDateFilter, setFromDateFilter] = useState("");
    const [toDateFilter, setToDateFilter] = useState("");
    const [quickFilter, setQuickFilter] = useState<"all" | "due">("all");

    // Student Search for Modal/Filters
    const [isSearchingStudent, setIsSearchingStudent] = useState(false);
    const [studentSearchResults, setStudentSearchResults] = useState<StudentBrief[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchDropdownRef = useRef<HTMLDivElement>(null);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [activeCheque, setActiveCheque] = useState<ChequeItem | null>(null);

    // Create Form State
    const [modalSearchQuery, setModalSearchQuery] = useState("");
    const [selectedModalStudent, setSelectedModalStudent] = useState<StudentBrief | null>(null);
    const [modalChequeNo, setModalChequeNo] = useState("");
    const [modalBankName, setModalBankName] = useState("");
    const [modalAmount, setModalAmount] = useState("");
    const [modalChequeDate, setModalChequeDate] = useState("");
    const [modalReceivedDate, setModalReceivedDate] = useState(new Date().toISOString().split("T")[0]);
    const [modalNotes, setModalNotes] = useState("");

    // Status Form State
    const [newStatus, setNewStatus] = useState<ChequeItem["status"]>("CASHED");
    const [cashedDate, setCashedDate] = useState(new Date().toISOString().split("T")[0]);
    const [statusNotes, setStatusNotes] = useState("");

    useEffect(() => {
        fetchCampuses();
        fetchCheques();

        const handleClickOutside = (e: MouseEvent) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Student search debouncer
    useEffect(() => {
        const query = showCreateModal ? modalSearchQuery : studentSearchQuery;
        if (!query.trim()) {
            setStudentSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingStudent(true);
            try {
                const { data } = await api.get(`/v1/students/search-simple?q=${query}`);
                setStudentSearchResults(data?.data || []);
                setShowSearchDropdown(true);
            } catch (err) {
                console.error("Student search failed:", err);
            } finally {
                setIsSearchingStudent(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [studentSearchQuery, modalSearchQuery, showCreateModal]);

    const fetchCampuses = async () => {
        try {
            const { data } = await api.get("/v1/campuses");
            if (data?.data) {
                setCampuses(data.data);
            }
        } catch (err) {
            console.error("Failed to load campuses:", err);
        }
    };

    const fetchCheques = async () => {
        setIsLoading(true);
        try {
            let url = "/v1/postdated-cheques";
            if (quickFilter === "due") {
                url = "/v1/postdated-cheques/due";
            }
            const { data } = await api.get(url);
            if (data?.data) {
                setCheques(data.data);
            }
        } catch (err) {
            toast.error("Failed to retrieve cheque records");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Refetch when quick filter changes
    useEffect(() => {
        fetchCheques();
    }, [quickFilter]);

    const handleCreateCheque = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedModalStudent) {
            toast.error("Please select a student");
            return;
        }
        if (!modalChequeNo.trim()) {
            toast.error("Cheque number is required");
            return;
        }
        if (!modalAmount || Number(modalAmount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }
        if (!modalChequeDate) {
            toast.error("Cheque date is required");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                student_id: selectedModalStudent.cc,
                cheque_number: modalChequeNo,
                bank_name: modalBankName || undefined,
                amount: Number(modalAmount),
                cheque_date: modalChequeDate,
                received_date: modalReceivedDate,
                received_by: user?.id || null,
                notes: modalNotes || undefined
            };

            const { data } = await api.post("/v1/postdated-cheques", payload);
            if (data.status === 201 || data.status === 200) {
                toast.success("Post-dated cheque recorded successfully");
                setShowCreateModal(false);
                resetCreateForm();
                fetchCheques();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to record cheque");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCheque) return;

        setSubmitting(true);
        try {
            const payload = {
                status: newStatus,
                cashed_by: newStatus === "CASHED" ? (user?.id || null) : undefined,
                cashed_date: newStatus === "CASHED" ? cashedDate : undefined,
                notes: statusNotes || undefined
            };

            const { data } = await api.patch(`/v1/postdated-cheques/${activeCheque.id}/status`, payload);
            if (data.status === 200) {
                toast.success("Cheque status updated successfully");
                setShowStatusModal(false);
                fetchCheques();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to update status");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteCheque = async () => {
        if (!activeCheque) return;

        setSubmitting(true);
        try {
            await api.delete(`/v1/postdated-cheques/${activeCheque.id}`);
            toast.success("Cheque record deleted");
            setShowDeleteModal(false);
            fetchCheques();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to delete cheque record");
        } finally {
            setSubmitting(false);
        }
    };

    const resetCreateForm = () => {
        setModalSearchQuery("");
        setSelectedModalStudent(null);
        setModalChequeNo("");
        setModalBankName("");
        setModalAmount("");
        setModalChequeDate("");
        setModalReceivedDate(new Date().toISOString().split("T")[0]);
        setModalNotes("");
    };

    // Client-side filtering logic
    const filteredCheques = cheques.filter(c => {
        // Status filter
        if (statusFilter && c.status !== statusFilter) return false;

        // Campus filter (if campus name resolver/campus_id matches)
        if (campusFilter && c.students?.campus_id !== Number(campusFilter)) return false;

        // Student filter
        if (selectedStudentFilter && c.students?.cc !== selectedStudentFilter.cc) return false;

        // Date filters
        if (fromDateFilter && new Date(c.cheque_date) < new Date(fromDateFilter)) return false;
        if (toDateFilter && new Date(c.cheque_date) > new Date(toDateFilter)) return false;

        return true;
    });

    // Stats calculations from filtered lists
    const todayStr = new Date().toISOString().split("T")[0];
    const today = new Date(todayStr);

    const pendingCheques = cheques.filter(c => c.status === "PENDING");
    
    const overdueCount = pendingCheques.filter(c => new Date(c.cheque_date) < today).length;
    
    const dueTodayCheques = pendingCheques.filter(c => c.cheque_date.startsWith(todayStr));
    const dueTodayCount = dueTodayCheques.length;
    const dueTodayAmount = dueTodayCheques.reduce((sum, c) => sum + Number(c.amount), 0);

    const in7DaysLimit = new Date();
    in7DaysLimit.setDate(in7DaysLimit.getDate() + 7);
    const dueIn7DaysCount = pendingCheques.filter(c => {
        const d = new Date(c.cheque_date);
        return d > today && d <= in7DaysLimit;
    }).length;

    const totalPendingAmount = pendingCheques.reduce((sum, c) => sum + Number(c.amount), 0);

    const getStatusStyles = (status: ChequeItem["status"]) => {
        switch (status) {
            case "PENDING":
                return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
            case "CASHED":
                return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
            case "BOUNCED":
                return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
            case "RETURNED":
                return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
            case "CANCELLED":
                return "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20";
        }
    };

    return (
        <div className="space-y-8 pb-20 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
                        <span className="p-2.5 bg-violet-500/10 rounded-[20px]">
                            <CreditCard className="h-7 w-7 text-violet-600 dark:text-violet-400" />
                        </span>
                        Post-dated Cheques
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1.5 text-sm font-medium">
                        Record, track, and manage clearing statuses for received post-dated cheques.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
                        className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-violet-500/20 transition-all hover:-translate-y-0.5 active:scale-95"
                    >
                        <Plus className="h-4 w-4" /> Record Cheque
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="p-3 w-fit rounded-2xl bg-rose-500/10 text-rose-500 mb-5">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Overdue Cheques</p>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1 tracking-tight font-outfit">
                            {isLoading ? "..." : overdueCount}
                        </h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="p-3 w-fit rounded-2xl bg-amber-500/10 text-amber-500 mb-5">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Due Today</p>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1 tracking-tight font-outfit">
                            {isLoading ? "..." : dueTodayCount}
                        </h3>
                        {dueTodayCount > 0 && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                                Rs. {Math.round(dueTodayAmount).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="p-3 w-fit rounded-2xl bg-blue-500/10 text-blue-500 mb-5">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Due in Next 7 Days</p>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1 tracking-tight font-outfit">
                            {isLoading ? "..." : dueIn7DaysCount}
                        </h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="p-3 w-fit rounded-2xl bg-violet-500/10 text-violet-500 mb-5">
                        <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Total Pending Clearing</p>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1 tracking-tight font-outfit">
                            {isLoading ? "..." : `Rs. ${Math.round(totalPendingAmount).toLocaleString()}`}
                        </h3>
                        <p className="text-[10px] text-zinc-400 mt-1 font-semibold">
                            {pendingCheques.length} Cheques total
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter and Table Card */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-6 shadow-sm space-y-6">
                {/* Filter Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-900">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Quick filter tabs */}
                        <button
                            onClick={() => setQuickFilter("all")}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${quickFilter === "all" ? "bg-violet-600 text-white shadow-md shadow-violet-500/20" : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400"}`}
                        >
                            All Cheques
                        </button>
                        <button
                            onClick={() => setQuickFilter("due")}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${quickFilter === "due" ? "bg-amber-600 text-white shadow-md shadow-amber-500/20" : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400"}`}
                        >
                            Due & Overdue
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full lg:w-auto">
                        {/* Status Filter */}
                        {quickFilter !== "due" && (
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none text-zinc-700 dark:text-zinc-300"
                            >
                                <option value="">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="CASHED">Cashed</option>
                                <option value="BOUNCED">Bounced</option>
                                <option value="RETURNED">Returned</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        )}

                        {/* Campus Filter */}
                        <select
                            value={campusFilter}
                            onChange={(e) => setCampusFilter(e.target.value)}
                            className="h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none text-zinc-700 dark:text-zinc-300"
                        >
                            <option value="">All Campuses</option>
                            {campuses.map(c => (
                                <option key={c.id} value={c.id}>{c.campus_name}</option>
                            ))}
                        </select>

                        {/* From Date Filter */}
                        <div className="relative">
                            <input
                                type="date"
                                value={fromDateFilter}
                                onChange={(e) => setFromDateFilter(e.target.value)}
                                className="h-10 w-full px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none text-zinc-700 dark:text-zinc-300"
                                placeholder="From Date"
                            />
                        </div>

                        {/* To Date Filter */}
                        <div className="relative">
                            <input
                                type="date"
                                value={toDateFilter}
                                onChange={(e) => setToDateFilter(e.target.value)}
                                className="h-10 w-full px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none text-zinc-700 dark:text-zinc-300"
                                placeholder="To Date"
                            />
                        </div>
                    </div>
                </div>

                {/* Student Search and Reset */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Filter Student */}
                    <div className="relative w-full md:max-w-md" ref={searchDropdownRef}>
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Filter by Student Name or CC..."
                                value={studentSearchQuery}
                                onChange={(e) => {
                                    setStudentSearchQuery(e.target.value);
                                    if (!e.target.value) {
                                        setSelectedStudentFilter(null);
                                    }
                                }}
                                className="w-full h-11 pl-10 pr-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300"
                            />
                            {isSearchingStudent && (
                                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-violet-600" />
                            )}
                            {studentSearchQuery && !isSearchingStudent && (
                                <button
                                    onClick={() => {
                                        setStudentSearchQuery("");
                                        setSelectedStudentFilter(null);
                                        setStudentSearchResults([]);
                                        setShowSearchDropdown(false);
                                    }}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {showSearchDropdown && !showCreateModal && studentSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                                {studentSearchResults.map(s => (
                                    <button
                                        key={s.cc}
                                        onClick={() => {
                                            setSelectedStudentFilter(s);
                                            setStudentSearchQuery(s.full_name);
                                            setShowSearchDropdown(false);
                                        }}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-left text-xs"
                                    >
                                        <div>
                                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{s.full_name}</p>
                                            <p className="text-[10px] text-zinc-400 mt-0.5">GR: {s.gr_number} · CC: {s.cc}</p>
                                        </div>
                                        {s.campuses && (
                                            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[9px] font-black rounded uppercase text-zinc-400">
                                                {s.campuses.campus_name}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {(selectedStudentFilter || fromDateFilter || toDateFilter || statusFilter || campusFilter) && (
                        <button
                            onClick={() => {
                                setStudentSearchQuery("");
                                setSelectedStudentFilter(null);
                                setFromDateFilter("");
                                setToDateFilter("");
                                setStatusFilter("");
                                setCampusFilter("");
                            }}
                            className="px-4 py-2 border border-rose-200 dark:border-rose-900 text-rose-500 hover:bg-rose-500/5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all w-fit"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>

                {/* Table list */}
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cheque info</th>
                                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Student</th>
                                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Dates</th>
                                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cashing info</th>
                                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-zinc-400">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-600 opacity-50" />
                                        <p className="mt-3 text-xs font-semibold">Loading post-dated cheques...</p>
                                    </td>
                                </tr>
                            ) : filteredCheques.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-zinc-400">
                                        <FileText className="h-10 w-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
                                        <p className="text-xs font-black">No post-dated cheques found</p>
                                        <p className="text-[10px] text-zinc-500 mt-1">Try adjusting your filter settings or record a new cheque.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredCheques.map(c => {
                                    const isChequeOverdue = c.status === "PENDING" && new Date(c.cheque_date) < today;

                                    return (
                                        <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                                            {/* Cheque Info */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                                                        {c.cheque_number}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 font-semibold flex items-center gap-1.5">
                                                        <Building className="h-3 w-3 shrink-0" />
                                                        {c.bank_name || "Unspecified Bank"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Student */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-zinc-950 dark:text-zinc-100">{c.students?.full_name}</span>
                                                    <span className="text-[10px] text-violet-500 dark:text-violet-400 bg-violet-500/5 px-2 py-0.5 rounded w-fit font-black tracking-wider">
                                                        CC-{c.students?.cc}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-6 py-4">
                                                <span className="text-[13px] font-black text-zinc-900 dark:text-zinc-100 font-mono">
                                                    Rs. {Number(c.amount).toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Dates */}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={`font-mono text-xs font-semibold ${isChequeOverdue ? "text-rose-500 font-bold" : "text-zinc-700 dark:text-zinc-300"}`}>
                                                        {c.cheque_date.slice(0, 10)}
                                                    </span>
                                                    <span className="text-[9px] text-zinc-400 uppercase tracking-tighter leading-none mt-1">
                                                        Recd: {c.received_date.slice(0, 10)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${getStatusStyles(c.status)}`}>
                                                    {c.status}
                                                </span>
                                                {isChequeOverdue && (
                                                    <span className="block text-[8px] text-rose-500 font-black uppercase tracking-widest mt-1">
                                                        Overdue
                                                    </span>
                                                )}
                                            </td>

                                            {/* Cashing Info */}
                                            <td className="px-6 py-4 text-xs">
                                                {c.status === "CASHED" ? (
                                                    <div className="flex flex-col gap-0.5 text-zinc-500">
                                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                                            {c.cashed_date ? c.cashed_date.slice(0, 10) : "—"}
                                                        </span>
                                                        <span className="text-[9px] uppercase tracking-tighter leading-none text-zinc-400">
                                                            By: {c.cashed_by_user?.full_name || "—"}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-400 italic text-[11px]">
                                                        {c.notes || "No notes"}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setActiveCheque(c);
                                                            setNewStatus(c.status === "CASHED" ? "PENDING" : "CASHED");
                                                            setStatusNotes(c.notes || "");
                                                            setShowStatusModal(true);
                                                        }}
                                                        className="p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:text-violet-600 dark:hover:text-violet-400 transition-colors shadow-sm"
                                                        title="Update status"
                                                    >
                                                        <FileSignature className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setActiveCheque(c);
                                                            setShowDeleteModal(true);
                                                        }}
                                                        className="p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-rose-500 rounded-xl transition-colors shadow-sm"
                                                        title="Delete record"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Cheque Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-[4px] z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl"
                        >
                            <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/20">
                                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 font-outfit">Record Post-dated Cheque</h3>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all">
                                    <X className="h-4 w-4 text-zinc-400" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateCheque} className="p-8 space-y-5">
                                {/* Search Student */}
                                <div className="space-y-2 relative" ref={searchDropdownRef}>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Select Student *</label>
                                    {selectedModalStudent ? (
                                        <div className="flex items-center justify-between p-4 bg-violet-500/5 border border-violet-500/20 rounded-2xl">
                                            <div>
                                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedModalStudent.full_name}</p>
                                                <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">CC-{selectedModalStudent.cc} · GR-{selectedModalStudent.gr_number}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedModalStudent(null);
                                                    setModalSearchQuery("");
                                                }}
                                                className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                            <input
                                                type="text"
                                                placeholder="Search Student Name, CC or GR..."
                                                value={modalSearchQuery}
                                                onChange={(e) => setModalSearchQuery(e.target.value)}
                                                className="w-full h-11 pl-10 pr-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300"
                                            />
                                            {isSearchingStudent && (
                                                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-violet-600" />
                                            )}
                                        </div>
                                    )}

                                    {showSearchDropdown && showCreateModal && studentSearchResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                                            {studentSearchResults.map(s => (
                                                <button
                                                    key={s.cc}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedModalStudent(s);
                                                        setShowSearchDropdown(false);
                                                    }}
                                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-left text-xs"
                                                >
                                                    <div>
                                                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{s.full_name}</p>
                                                        <p className="text-[10px] text-zinc-400 mt-0.5">GR: {s.gr_number} · CC: {s.cc}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Cheque details */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cheque Number *</label>
                                        <input
                                            type="text"
                                            value={modalChequeNo}
                                            onChange={(e) => setModalChequeNo(e.target.value)}
                                            placeholder="e.g. AB12345"
                                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Bank Name</label>
                                        <input
                                            type="text"
                                            value={modalBankName}
                                            onChange={(e) => setModalBankName(e.target.value)}
                                            placeholder="e.g. Habib Bank"
                                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cheque Amount (PKR) *</label>
                                    <input
                                        type="number"
                                        value={modalAmount}
                                        onChange={(e) => setModalAmount(e.target.value)}
                                        placeholder="e.g. 25000"
                                        className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cheque Date *</label>
                                        <input
                                            type="date"
                                            value={modalChequeDate}
                                            onChange={(e) => setModalChequeDate(e.target.value)}
                                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Received Date *</label>
                                        <input
                                            type="date"
                                            value={modalReceivedDate}
                                            onChange={(e) => setModalReceivedDate(e.target.value)}
                                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notes</label>
                                    <textarea
                                        rows={3}
                                        value={modalNotes}
                                        onChange={(e) => setModalNotes(e.target.value)}
                                        placeholder="Add any instructions, voucher references or custom details..."
                                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300 resize-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        disabled={submitting}
                                        className="px-5 py-2.5 text-xs font-black uppercase tracking-widest border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all disabled:opacity-50 active:scale-95"
                                    >
                                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Save Cheque
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Update Status Modal */}
            <AnimatePresence>
                {showStatusModal && activeCheque && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-[4px] z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/20">
                                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 font-outfit">Update Cheque Status</h3>
                                <button onClick={() => setShowStatusModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all">
                                    <X className="h-4 w-4 text-zinc-400" />
                                </button>
                            </div>

                            <form onSubmit={handleUpdateStatus} className="p-8 space-y-5">
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-900 rounded-2xl space-y-2">
                                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                        Cheque: <span className="font-mono text-zinc-950 dark:text-zinc-100">{activeCheque.cheque_number}</span>
                                    </p>
                                    <p className="text-xs text-zinc-500 font-medium">
                                        Student: {activeCheque.students?.full_name} (CC-{activeCheque.students?.cc})
                                    </p>
                                    <p className="text-xs text-zinc-950 dark:text-zinc-100 font-black">
                                        Amount: Rs. {Number(activeCheque.amount).toLocaleString()}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Select New Status *</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(["PENDING", "CASHED", "BOUNCED", "RETURNED", "CANCELLED"] as const).map(st => (
                                            <button
                                                key={st}
                                                type="button"
                                                onClick={() => setNewStatus(st)}
                                                className={`px-3 py-2.5 text-center text-xs font-bold rounded-xl border transition-all ${
                                                    newStatus === st
                                                        ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20"
                                                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                                                }`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {newStatus === "CASHED" && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cashing Date *</label>
                                        <input
                                            type="date"
                                            value={cashedDate}
                                            onChange={(e) => setCashedDate(e.target.value)}
                                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notes</label>
                                    <textarea
                                        rows={3}
                                        value={statusNotes}
                                        onChange={(e) => setStatusNotes(e.target.value)}
                                        placeholder="Add reason for status change (e.g. bounce details, return logs)..."
                                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition-all text-zinc-700 dark:text-zinc-300 resize-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                                    <button
                                        type="button"
                                        onClick={() => setShowStatusModal(false)}
                                        disabled={submitting}
                                        className="px-5 py-2.5 text-xs font-black uppercase tracking-widest border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all disabled:opacity-50 active:scale-95"
                                    >
                                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && activeCheque && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-[4px] z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl p-8 space-y-6"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="p-4 bg-rose-500/10 text-rose-500 rounded-full mb-4">
                                    <Trash2 className="h-6 w-6" />
                                </div>
                                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50 font-outfit">Delete Cheque Record?</h3>
                                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                                    Are you sure you want to permanently delete cheque <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{activeCheque.cheque_number}</span>?
                                    This action is irreversible.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={submitting}
                                    className="flex-1 py-3 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteCheque}
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-rose-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 transition-all disabled:opacity-50 active:scale-95"
                                >
                                    {submitting ? "Deleting..." : "Yes, Delete"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
