"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Award, ArrowLeftRight, Receipt, DoorOpen, History, Loader2, Clock, User, ExternalLink, Download } from "lucide-react";
import api from "@/lib/api";
import { AdmissionOrderTab } from "./AdmissionOrderTab";
import { LeavingCertificateTab } from "./LeavingCertificateTab";
import { TransferOrderTab } from "./TransferOrderTab";

interface Props {
    cc: number;
    student: any;
}

type DocType = "admission_order" | "leaving_certificate" | "transfer_order" | "deposit_slip";

interface HistoryLog {
    id: number;
    document_type: string;
    ref_number: string | null;
    notes: string | null;
    generated_by: string;
    generated_at: string;
}

export function CertificatesStudioTab({ cc, student }: Props) {
    const isSoft = (student?.status || "").toUpperCase() === "SOFT_ADMISSION";
    const isLeft = (student?.status || "").toUpperCase() === "LEFT";
    const hasTransfer = !!student?.has_transfer;
    const hasQuickSlip = !!student?.has_quick_admission_slip;

    // Default active document
    const getDefaultDoc = (): DocType => {
        if (isLeft) return "leaving_certificate";
        if (hasQuickSlip) return "deposit_slip";
        if (hasTransfer) return "transfer_order";
        return "admission_order";
    };

    const [activeDoc, setActiveDoc] = useState<DocType>(getDefaultDoc);
    const [history, setHistory] = useState<HistoryLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!cc) return;
        setLoadingHistory(true);
        try {
            const { data } = await api.get(`/v1/enrollments/${cc}/certificate-history`);
            setHistory(data?.data || []);
        } catch {
            setHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    }, [cc]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Refresh history whenever switching document generator tabs
    const handleSelectDoc = (doc: DocType) => {
        setActiveDoc(doc);
        fetchHistory();
    };

    const formatDate = (iso: string) => {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
        } catch {
            return iso;
        }
    };

    const docCards: Array<{
        id: DocType;
        title: string;
        description: string;
        icon: any;
        badge: string;
        enabled: boolean;
        disabledReason?: string;
        color: string;
        bgColor: string;
        borderColor: string;
    }> = [
        {
            id: "admission_order",
            title: "Admission Order",
            description: "Official student enrollment & class allocation order",
            icon: FileText,
            badge: "Enrolled",
            enabled: !isSoft,
            disabledReason: "Available for confirmed / enrolled students",
            color: "text-indigo-600 dark:text-indigo-400",
            bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
            borderColor: "border-indigo-200 dark:border-indigo-800",
        },
        {
            id: "leaving_certificate",
            title: "Leaving Certificate (SLC)",
            description: "Official School Leaving Certificate & clearance document",
            icon: DoorOpen,
            badge: isLeft ? "Eligible" : "Left Only",
            enabled: isLeft,
            disabledReason: "Available only when student status is LEFT",
            color: "text-red-600 dark:text-red-400",
            bgColor: "bg-red-50 dark:bg-red-950/40",
            borderColor: "border-red-200 dark:border-red-800",
        },
        {
            id: "transfer_order",
            title: "Transfer Order",
            description: "Inter-campus relocation & section transfer order",
            icon: ArrowLeftRight,
            badge: hasTransfer ? "Transferred" : "No Transfer",
            enabled: hasTransfer,
            disabledReason: "Student has no campus transfer record",
            color: "text-emerald-600 dark:text-emerald-400",
            bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
            borderColor: "border-emerald-200 dark:border-emerald-800",
        },
        {
            id: "deposit_slip",
            title: "Deposit Slip",
            description: "Quick Admission deposit slip & payment receipt",
            icon: Receipt,
            badge: hasQuickSlip ? "Quick Slip" : "Standard",
            enabled: hasQuickSlip,
            disabledReason: "Available for Quick Admission records",
            color: "text-amber-600 dark:text-amber-400",
            bgColor: "bg-amber-50 dark:bg-amber-950/40",
            borderColor: "border-amber-200 dark:border-amber-800",
        },
    ];

    const handleDownloadHistoryDoc = (item: HistoryLog) => {
        const docTypeLower = (item.document_type || "").toLowerCase();

        if (docTypeLower.includes("deposit")) {
            window.open(`/api/v1/unconfirmed-admissions/${cc}/deposit-slip`, "_blank");
            return;
        }

        if (docTypeLower.includes("leaving") || docTypeLower.includes("slc")) {
            setActiveDoc("leaving_certificate");
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (docTypeLower.includes("transfer")) {
            setActiveDoc("transfer_order");
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        setActiveDoc("admission_order");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="space-y-8">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-white/15 backdrop-blur-md rounded-xl">
                        <Award className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black tracking-tight">Certificates & Documents Studio</h3>
                        <p className="text-xs text-white/80 font-medium">Select a certificate type to customize, preview, and generate official documents.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold font-mono bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
                        CC #{student.cc}
                    </span>
                    <span className="text-[11px] font-bold bg-white text-indigo-900 px-3 py-1 rounded-full uppercase tracking-wider">
                        {student.status}
                    </span>
                </div>
            </div>

            {/* Document Selector Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {docCards.map((card) => {
                    const Icon = card.icon;
                    const isSelected = activeDoc === card.id;

                    return (
                        <button
                            key={card.id}
                            type="button"
                            disabled={!card.enabled}
                            onClick={() => handleSelectDoc(card.id)}
                            className={`relative text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between h-36 ${
                                isSelected
                                    ? `ring-2 ring-violet-600 dark:ring-violet-400 ${card.bgColor} ${card.borderColor} shadow-lg`
                                    : card.enabled
                                    ? `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md`
                                    : `bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60 cursor-not-allowed`
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className={`p-2 rounded-xl ${card.bgColor} ${card.color}`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                        card.enabled ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                                    }`}>
                                        {card.badge}
                                    </span>
                                </div>
                                <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{card.title}</h4>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{card.description}</p>
                            </div>

                            {!card.enabled && (
                                <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-2 italic line-clamp-1">
                                    ⚠️ {card.disabledReason}
                                </p>
                            )}

                            {isSelected && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active Document Generator Area */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        <h4 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                            {docCards.find((c) => c.id === activeDoc)?.title} Generator
                        </h4>
                    </div>
                </div>

                {activeDoc === "admission_order" && <AdmissionOrderTab cc={cc} />}
                {activeDoc === "leaving_certificate" && <LeavingCertificateTab cc={cc} />}
                {activeDoc === "transfer_order" && <TransferOrderTab cc={cc} />}
                {activeDoc === "deposit_slip" && (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-dashed border-amber-200 dark:border-amber-800">
                        <Receipt className="h-10 w-10 text-amber-600 dark:text-amber-400 mb-3" />
                        <h4 className="text-sm font-black text-amber-950 dark:text-amber-200 uppercase tracking-wide">Quick Admission Deposit Slip</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-400 max-w-md mt-1 mb-4 leading-relaxed">
                            Generate and print the official bank deposit slip for this student record.
                        </p>
                        <a
                            href={`/api/v1/unconfirmed-admissions/${cc}/deposit-slip`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Open & Print Deposit Slip PDF
                        </a>
                    </div>
                )}
            </div>

            {/* History of Generated Certificates Section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <div>
                            <h4 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                Certificate Issuance & Generation History
                            </h4>
                            <p className="text-xs text-zinc-400 font-medium">Log of all previously generated certificates and official orders for this student.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={fetchHistory}
                        disabled={loadingHistory}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-xl transition-all"
                    >
                        {loadingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                        Refresh Logs
                    </button>
                </div>

                {loadingHistory ? (
                    <div className="flex items-center justify-center p-12 text-zinc-400">
                        <Loader2 className="h-6 w-6 animate-spin mr-2 text-violet-600" />
                        <span className="text-xs font-bold uppercase tracking-wider">Loading history logs...</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="p-10 text-center bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        <History className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs font-bold text-zinc-500">No certificate generation history recorded yet.</p>
                        <p className="text-[11px] text-zinc-400 mt-1">Generating or downloading a certificate will automatically log an issuance event here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] uppercase tracking-wider font-black text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/50">
                                    <th className="py-3 px-4 rounded-l-xl">Document Type</th>
                                    <th className="py-3 px-4">Ref / Certificate #</th>
                                    <th className="py-3 px-4">Notes</th>
                                    <th className="py-3 px-4">Issued By</th>
                                    <th className="py-3 px-4">Generated Date & Time</th>
                                    <th className="py-3 px-4 rounded-r-xl text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                                {history.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="py-3 px-4">
                                            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                                <Award className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                                {item.document_type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {item.ref_number || "—"}
                                        </td>
                                        <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                                            {item.notes || "—"}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                                <User className="h-3 w-3 text-zinc-400" />
                                                {item.generated_by || "STAFF"}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                                            {formatDate(item.generated_at)}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadHistoryDoc(item)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 border border-violet-200/80 dark:border-violet-800/80 rounded-xl transition-all shadow-sm active:scale-95"
                                                title="Open and re-download form"
                                            >
                                                <Download className="h-3 w-3" />
                                                <span>Re-Download</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
