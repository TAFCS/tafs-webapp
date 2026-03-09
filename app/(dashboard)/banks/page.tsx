"use client";

import { useState } from "react";
import {
    Building2,
    Plus,
    Search,
    MoreVertical,
    Edit2,
    Trash2,
    CreditCard,
    MapPin,
    Hash,
    User,
    ChevronRight,
    Loader2,
    CheckCircle2,
    X
} from "lucide-react";
import toast from "react-hot-toast";

interface Bank {
    id: string;
    name: string;
    title: string;
    account: string;
    branch: string;
    address: string;
    iban: string;
    isActive: boolean;
}

const DUMMY_BANKS: Bank[] = [
    {
        id: "1",
        name: "Meezan Bank Limited",
        title: "TAFS SCHOOL SYSTEM",
        account: "1234-567890-001",
        branch: "0102",
        address: "DHA Phase 6 Branch, Karachi",
        iban: "PK00 MEZN 0000 1234 5678 9001",
        isActive: true
    },
    {
        id: "2",
        name: "Habib Bank Limited (HBL)",
        title: "TAFSYNC PRIVATE LIMITED",
        account: "0042-345678-002",
        branch: "0042",
        address: "Main Boulevard, Lahore",
        iban: "PK72 HABB 0000 0042 3456 7802",
        isActive: true
    },
    {
        id: "3",
        name: "Bank Al-Falah",
        title: "THE ACADEMY OF FUTURE STUDIES",
        account: "5500-112233-005",
        branch: "5500",
        address: "I.I. Chundrigar Road, Karachi",
        iban: "PK11 ALFH 0000 5500 1122 3305",
        isActive: true
    }
];

export default function BanksManagement() {
    const [banks, setBanks] = useState<Bank[]>(DUMMY_BANKS);
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        title: "",
        account: "",
        branch: "",
        address: "",
        iban: ""
    });

    const filteredBanks = banks.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddBank = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await new Promise(r => setTimeout(r, 800)); // Simulate
            const newBank: Bank = {
                id: Math.random().toString(36).substr(2, 9),
                ...formData,
                isActive: true
            };
            setBanks([newBank, ...banks]);
            setShowAddModal(false);
            setFormData({ name: "", title: "", account: "", branch: "", address: "", iban: "" });
            toast.success("Bank account added successfully!");
        } catch (err) {
            toast.error("Failed to add bank.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to remove this bank account?")) {
            setBanks(banks.filter(b => b.id !== id));
            toast.success("Bank removed.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 mt-4 px-4">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 flex items-center gap-4">
                        <div className="h-12 w-12 bg-zinc-900 text-white rounded-[18px] flex items-center justify-center shadow-xl shadow-zinc-200">
                            <Building2 className="h-6 w-6" />
                        </div>
                        Collection Banks
                    </h1>
                    <p className="text-zinc-500 font-medium ml-1">Manage institutional bank accounts for fee collection and payouts.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search banks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-12 w-full md:w-72 pl-11 pr-4 bg-white border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="h-12 px-6 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-lg shadow-zinc-200 active:scale-95"
                    >
                        <Plus className="h-4 w-4" /> Add New Bank
                    </button>
                </div>
            </div>

            {/* Banks Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredBanks.map((bank) => (
                    <div
                        key={bank.id}
                        className="group relative bg-white border border-zinc-200 rounded-[32px] p-8 hover:border-zinc-300 hover:shadow-2xl hover:shadow-zinc-200/50 transition-all duration-500 overflow-hidden"
                    >
                        {/* Status Badge */}
                        <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 animate-in fade-in zoom-in duration-300">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                        </div>

                        {/* Bank Identity */}
                        <div className="flex items-start gap-5 mb-8">
                            <div className="h-16 w-16 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-100 group-hover:scale-110 group-hover:bg-zinc-100 transition-all duration-500">
                                <Building2 className="h-7 w-7 text-zinc-400 group-hover:text-zinc-900" />
                            </div>
                            <div className="flex-1 pr-12">
                                <h3 className="text-lg font-black text-zinc-900 leading-tight group-hover:text-primary transition-colors">{bank.name}</h3>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1 line-clamp-1">{bank.address}</p>
                            </div>
                        </div>

                        {/* Account Details */}
                        <div className="space-y-4">
                            <div className="p-4 bg-zinc-50 rounded-[20px] border border-zinc-100 group-hover:bg-white transition-colors duration-500">
                                <div className="flex items-center gap-3 mb-2">
                                    <User className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Account Title</span>
                                </div>
                                <p className="text-sm font-black text-zinc-800 ml-6.5">{bank.title}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-50 rounded-[20px] border border-zinc-100 group-hover:bg-white transition-colors duration-500">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Hash className="h-3.5 w-3.5 text-zinc-400" />
                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Account No.</span>
                                    </div>
                                    <p className="text-sm font-black text-zinc-800 ml-6.5">{bank.account}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 rounded-[20px] border border-zinc-100 group-hover:bg-white transition-colors duration-500">
                                    <div className="flex items-center gap-3 mb-2">
                                        <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Br. Code</span>
                                    </div>
                                    <p className="text-sm font-black text-zinc-800 ml-6.5">{bank.branch}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-zinc-900 text-white rounded-[20px] shadow-lg shadow-zinc-200">
                                <div className="flex items-center gap-3 mb-2">
                                    <CreditCard className="h-3.5 w-3.5 text-zinc-500" />
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">IBAN Number</span>
                                </div>
                                <p className="text-xs font-mono font-bold tracking-wider ml-6.5 text-zinc-300">{bank.iban}</p>
                            </div>
                        </div>

                        {/* Actions Overlay */}
                        <div className="mt-8 pt-8 border-t border-zinc-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button className="p-2.5 bg-zinc-50 text-zinc-500 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(bank.id)}
                                    className="p-2.5 bg-zinc-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors">
                                View History <ChevronRight className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Empty State */}
                {filteredBanks.length === 0 && (
                    <div className="col-span-full py-32 text-center bg-zinc-50 rounded-[40px] border-2 border-dashed border-zinc-200">
                        <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-zinc-200">
                            <Building2 className="h-10 w-10 text-zinc-300" />
                        </div>
                        <h3 className="text-2xl font-black text-zinc-900">No banks found</h3>
                        <p className="text-zinc-500 font-medium mt-2">Adjust your search or add a new bank account to get started.</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-8 px-8 h-12 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-zinc-800 transition-all shadow-lg"
                        >
                            Create First Bank
                        </button>
                    </div>
                )}
            </div>

            {/* Add Bank Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 min-h-screen">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !isSaving && setShowAddModal(false)} />

                    {/* Modal Content */}
                    <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                        <div className="p-8 md:p-12">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                                        <Plus className="h-6 w-6 text-primary" />
                                        Add Bank Account
                                    </h2>
                                    <p className="text-zinc-500 text-sm font-medium mt-1">Fill in the details for the new collection bank.</p>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="h-10 w-10 bg-zinc-100 rounded-full flex items-center justify-center hover:bg-zinc-200 transition-colors"
                                >
                                    <X className="h-5 w-5 text-zinc-500" />
                                </button>
                            </div>

                            <form onSubmit={handleAddBank} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Bank Name</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g. Meezan Bank"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 border border-zinc-200 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Account Title</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Holder Name"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 border border-zinc-200 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Account Number</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="0000-000000-00"
                                            value={formData.account}
                                            onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 border border-zinc-200 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Branch Code</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="4 Digits"
                                            value={formData.branch}
                                            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 border border-zinc-200 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">IBAN Number</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="PK00 XXXX 0000..."
                                            value={formData.iban}
                                            onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-900 text-white rounded-[20px] text-sm font-bold tracking-widest focus:outline-none transition-all placeholder:text-zinc-600"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Bank Address</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Complete branch location"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 border border-zinc-200 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 h-14 bg-zinc-50 text-zinc-500 rounded-[20px] font-black uppercase tracking-widest text-[11px] hover:bg-zinc-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-[2] h-14 bg-zinc-900 text-white rounded-[20px] font-black uppercase tracking-widest text-[11px] hover:bg-zinc-800 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-zinc-200 disabled:opacity-50 active:scale-[0.98]"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        {isSaving ? "Saving Details..." : "Confirm & Create"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
