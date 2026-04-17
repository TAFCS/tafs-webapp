"use client";
import { useState } from "react";
import { Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import api from "@/lib/api";

export function DangerZoneTab({ student }: { student: any }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [dfText, setDfText] = useState("");
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const handleHardDelete = async () => {
        if (dfText !== String(student.cc)) {
            alert("Incorrect CC number. Please type the student's CC exactly as shown.");
            return;
        }

        setIsDeleting(true);
        try {
            await api.delete(`/v1/staff-editing/students/${student.cc}/hard-delete`);
            alert("Student profile permanently deleted.");
            window.location.reload(); 
        } catch (e) {
            console.error(e);
            alert("Failed to delete student: " + ((e as any)?.response?.data?.message || "Unknown error"));
        } finally {
            setIsDeleting(false);
            setIsDeleteConfirmOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-[14px] font-black text-rose-900 uppercase tracking-tight">Permanent Profile Deletion</h3>
                        <p className="text-[11px] text-rose-700 font-medium mt-1 uppercase leading-relaxed">
                            This action will permanently remove <span className="font-black underline">{student.full_name}</span> and all associated records from the system.
                        </p>
                    </div>
                </div>

                <div className="mt-8 border-t border-rose-100 pt-6">
                    <div className="bg-white border border-rose-100 rounded-xl p-5 space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle className="h-4 w-4" />
                            <p className="text-[11px] font-black uppercase tracking-widest">Impact of this action</p>
                        </div>
                        
                        <ul className="grid grid-cols-2 gap-x-8 gap-y-2">
                            {[
                                "Financial History (Vouchers & Fees)",
                                "Academic Records & Admissions",
                                "Family/Household Linkage",
                                "Document History & Activity Logs",
                                "Attendance & Grade Data",
                                "Guardian & Contact Information"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase">
                                    <div className="h-1 w-1 bg-rose-400 rounded-full" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {!isDeleteConfirmOpen ? (
                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={() => setIsDeleteConfirmOpen(true)}
                            className="px-6 h-10 text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                        >
                            Start Deletion Process
                        </button>
                    </div>
                ) : (
                    <div className="mt-6 p-5 bg-white border-2 border-rose-500 rounded-xl space-y-5 animate-in zoom-in-95 duration-200">
                        <div>
                            <p className="text-[13px] font-black text-zinc-900 uppercase italic">Confirm Identity Verification</p>
                            <p className="text-[10px] text-zinc-500 mt-1 uppercase font-medium">To proceed, please enter the student's unique Computer Code (CC) below.</p>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-rose-600 uppercase tracking-wider">
                                Type Student CC: <span className="bg-rose-100 px-2 py-0.5 rounded ml-1 font-mono">#{student.cc}</span>
                            </label>
                            <div className="flex gap-3">
                                <input 
                                    type="text"
                                    value={dfText}
                                    onChange={e => setDfText(e.target.value)}
                                    placeholder={`ENTER ${student.cc} TO CONFIRM`}
                                    className="flex-1 h-11 px-4 text-[14px] font-mono font-black text-rose-600 bg-rose-50 border-2 border-rose-100 rounded-xl outline-none focus:border-rose-500 transition-all text-center uppercase"
                                />
                                <button 
                                    onClick={handleHardDelete}
                                    disabled={isDeleting || dfText !== String(student.cc)}
                                    className="px-8 h-11 text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-all shadow-lg shadow-rose-200"
                                >
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & Wipe"}
                                </button>
                                <button 
                                    onClick={() => {
                                        setIsDeleteConfirmOpen(false);
                                        setDfText("");
                                    }}
                                    className="px-5 h-11 text-[11px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-500 rounded-xl hover:bg-zinc-200 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-center">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter italic">
                    Logged administrative action: Hard deletion will be recorded in system audit logs.
                </p>
            </div>
        </div>
    );
}
