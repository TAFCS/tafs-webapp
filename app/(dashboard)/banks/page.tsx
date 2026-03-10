"use client";

import { useEffect, useState } from "react";
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
    X,
    AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";
import { bankAccountsService, BankAccount } from "@/lib/bank-accounts.service";

export default function BanksManagement() {
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        bank_name: "",
        account_title: "",
        account_number: "",
        branch_code: "",
        bank_address: "",
        iban: ""
    });

    useEffect(() => {
        fetchBanks();
    }, []);

    const fetchBanks = async () => {
        setIsLoading(true);
        try {
            const data = await bankAccountsService.getAll();
            setBanks(data);
        } catch (err) {
            toast.error("Failed to fetch bank accounts");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredBanks = banks.filter(b =>
        b.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.account_title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenAdd = () => {
        setEditingBank(null);
        setFormData({
            bank_name: "",
            account_title: "",
            account_number: "",
            branch_code: "",
            bank_address: "",
            iban: ""
        });
        setShowModal(true);
    };

    const handleOpenEdit = (bank: BankAccount) => {
        setEditingBank(bank);
        setFormData({
            bank_name: bank.bank_name,
            account_title: bank.account_title,
            account_number: bank.account_number,
            branch_code: bank.branch_code || "",
            bank_address: bank.bank_address || "",
            iban: bank.iban || ""
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingBank) {
                await bankAccountsService.update(editingBank.id, formData);
                toast.success("Bank account updated successfully!");
            } else {
                await bankAccountsService.create(formData);
                toast.success("Bank account added successfully!");
            }
            fetchBanks();
            setShowModal(false);
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to save bank details";
            toast.error(typeof msg === 'string' ? msg : "Duplicate details found");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm("Are you sure you want to remove this bank account?")) {
            try {
                await bankAccountsService.delete(id);
                setBanks(banks.filter(b => b.id !== id));
                toast.success("Bank removed.");
            } catch (err) {
                toast.error("Failed to delete bank.");
            }
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 mt-4 px-4">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-4">
                        <div className="h-12 w-12 bg-zinc-900 text-white rounded-[18px] flex items-center justify-center shadow-xl shadow-zinc-200">
                            <Building2 className="h-6 w-6" />
                        </div>
                        Collection Banks
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium ml-1">Manage institutional bank accounts for fee collection and payouts.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-zinc-900 dark:text-zinc-100 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search banks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-12 w-full md:w-72 pl-11 pr-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={handleOpenAdd}
                        className="h-12 px-6 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-lg shadow-zinc-200 active:scale-95"
                    >
                        <Plus className="h-4 w-4" /> Add New Bank
                    </button>
                </div>
            </div>

            {/* Banks Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[400px] bg-zinc-50 dark:bg-zinc-900 rounded-[32px] animate-pulse border border-zinc-100" />
                    ))
                ) : filteredBanks.map((bank) => (
                    <div
                        key={bank.id}
                        className="group relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 hover:border-zinc-300 dark:border-zinc-700 hover:shadow-2xl hover:shadow-zinc-200/50 transition-all duration-500 overflow-hidden"
                    >
                        {/* Status Badge */}
                        <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 animate-in fade-in zoom-in duration-300">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                        </div>

                        {/* Bank Identity */}
                        <div className="flex items-start gap-5 mb-8">
                            <div className="h-16 w-16 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-100 group-hover:scale-110 group-hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all duration-500">
                                <Building2 className="h-7 w-7 text-zinc-400 group-hover:text-zinc-900 dark:text-zinc-100" />
                            </div>
                            <div className="flex-1 pr-12">
                                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-primary transition-colors">{bank.bank_name}</h3>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1 line-clamp-1">{bank.bank_address || "No address provided"}</p>
                            </div>
                        </div>

                        {/* Account Details */}
                        <div className="space-y-4">
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-[20px] border border-zinc-100 group-hover:bg-white dark:bg-zinc-950 transition-colors duration-500">
                                <div className="flex items-center gap-3 mb-2">
                                    <User className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Account Title</span>
                                </div>
                                <p className="text-sm font-black text-zinc-800 dark:text-zinc-200 ml-6.5">{bank.account_title}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-[20px] border border-zinc-100 group-hover:bg-white dark:bg-zinc-950 transition-colors duration-500">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Hash className="h-3.5 w-3.5 text-zinc-400" />
                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Account No.</span>
                                    </div>
                                    <p className="text-sm font-black text-zinc-800 dark:text-zinc-200 ml-6.5">{bank.account_number}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-[20px] border border-zinc-100 group-hover:bg-white dark:bg-zinc-950 transition-colors duration-500">
                                    <div className="flex items-center gap-3 mb-2">
                                        <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Br. Code</span>
                                    </div>
                                    <p className="text-sm font-black text-zinc-800 dark:text-zinc-200 ml-6.5">{bank.branch_code || "N/A"}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-zinc-900 text-white rounded-[20px] shadow-lg shadow-zinc-200">
                                <div className="flex items-center gap-3 mb-2">
                                    <CreditCard className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                    <span className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">IBAN Number</span>
                                </div>
                                <p className="text-xs font-mono font-bold tracking-wider ml-6.5 text-zinc-300">{bank.iban || "NOT PROVIDED"}</p>
                            </div>
                        </div>

                        {/* Actions Overlay */}
                        <div className="mt-8 pt-8 border-t border-zinc-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => handleOpenEdit(bank)}
                                    className="p-2.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(bank.id)}
                                    className="p-2.5 bg-zinc-50 dark:bg-zinc-900 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:text-zinc-100 transition-colors">
                                View History <ChevronRight className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Empty State */}
                {!isLoading && filteredBanks.length === 0 && (
                    <div className="col-span-full py-32 text-center bg-zinc-50 dark:bg-zinc-900 rounded-[40px] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                        <div className="h-20 w-20 bg-white dark:bg-zinc-950 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-zinc-200">
                            <Building2 className="h-10 w-10 text-zinc-300" />
                        </div>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">No banks found</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2">Adjust your search or add a new bank account to get started.</p>
                        <button
                            onClick={handleOpenAdd}
                            className="mt-8 px-8 h-12 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-zinc-800 transition-all shadow-lg"
                        >
                            Create First Bank
                        </button>
                    </div>
                )}
            </div>

            {/* Add/Edit Bank Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 min-h-screen">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !isSaving && setShowModal(false)} />

                    {/* Modal Content */}
                    <div className="relative bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                        <div className="p-8 md:p-12">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
                                        {editingBank ? <Edit2 className="h-6 w-6 text-primary" /> : <Plus className="h-6 w-6 text-primary" />}
                                        {editingBank ? "Update Bank Account" : "Add Bank Account"}
                                    </h2>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mt-1">
                                        {editingBank ? "Modify the existing bank account details." : "Fill in the details for the new collection bank."}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-200 transition-colors"
                                >
                                    <X className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Bank Name</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g. Meezan Bank"
                                            value={formData.bank_name}
                                            onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Account Title</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Holder Name"
                                            value={formData.account_title}
                                            onChange={(e) => setFormData({ ...formData, account_title: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Account Number</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="0000-000000-00"
                                            value={formData.account_number}
                                            onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Branch Code</label>
                                        <input
                                            type="text"
                                            placeholder="4 Digits (Optional)"
                                            value={formData.branch_code}
                                            onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">IBAN Number</label>
                                        <input
                                            type="text"
                                            placeholder="PK00 XXXX 0000... (Optional)"
                                            value={formData.iban}
                                            onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-900 text-white rounded-[20px] text-sm font-bold tracking-widest focus:outline-none transition-all placeholder:text-zinc-600 dark:text-zinc-400"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Bank Address</label>
                                        <input
                                            type="text"
                                            placeholder="Complete branch location (Optional)"
                                            value={formData.bank_address}
                                            onChange={(e) => setFormData({ ...formData, bank_address: e.target.value })}
                                            className="w-full h-14 px-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 h-14 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 rounded-[20px] font-black uppercase tracking-widest text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-[2] h-14 bg-zinc-900 text-white rounded-[20px] font-black uppercase tracking-widest text-[11px] hover:bg-zinc-800 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-zinc-200 disabled:opacity-50 active:scale-[0.98]"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        {isSaving ? "Saving Details..." : (editingBank ? "Update Account" : "Confirm & Create")}
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
