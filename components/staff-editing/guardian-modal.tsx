"use client";

import { useState, useEffect, useMemo } from "react";
import {
    X,
    Plus,
    Loader2,
    CheckCircle,
    AlertCircle,
    UserPlus,
    UserCircle,
    Star,
    Trash2
} from "lucide-react";
import api from "@/lib/api";

// Custom debounce function
function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

// Date helpers
function formatDateToDisplay(dateStr: string | null): string {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
}

function formatDateToJSON(dateStr: string | null): string | null {
    return dateStr; // Backend now expects DD/MM/YYYY, so we just pass it through
}

function formatNIC(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 13);
    let res = "";
    if (digits.length > 0) res += digits.slice(0, 5);
    if (digits.length > 5) res += "-" + digits.slice(5, 12);
    if (digits.length > 12) res += "-" + digits.slice(12, 13);
    return res;
}

const RELATIONSHIP_OPTIONS = ["NULL", "MOTHER", "FATHER", "OTHER"];
const COUNTRY_OPTIONS = ["NULL", "PAKISTAN", "OTHER"];
const PAKISTAN_PROVINCES = ["NULL", "SINDH", "BALOCHISTAN", "PUNJAB", "KPK", "GILGIT BALTISTAN", "OTHER"];

interface Guardian {
    id?: number;
    relationship: string;
    is_primary_contact: boolean;
    is_emergency_contact: boolean;
    full_name: string;
    cnic: string | null;
    dob: string | null;
    primary_phone_country_code: string | null;
    primary_phone: string | null;
    whatsapp_country_code: string | null;
    whatsapp_number: string | null;
    work_phone_country_code: string | null;
    work_phone: string | null;
    email_address: string | null;
    education_level: string | null;
    occupation: string | null;
    organization: string | null;
    job_position: string | null;
    monthly_income: string | null;
    work_address: string | null;
    mailing_address: string | null;
    house_appt_name: string | null;
    house_appt_number: string | null;
    area_block: string | null;
    country: string | null;
    province: string | null;
    city: string | null;
    occupational_position: string | null;
    place_of_birth: string | null;
    isNew?: boolean;
}

interface GuardianModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: number;
    studentName: string;
}

export function GuardianModal({ isOpen, onClose, studentId, studentName }: GuardianModalProps) {
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [patchingStatus, setPatchingStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});

    // Delete state
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchGuardians = async () => {
        if (!studentId) return;
        setIsLoading(true);
        try {
            const { data } = await api.get(`/v1/staff-editing/students/${studentId}/guardians`);
            // Backend now returns DD/MM/YYYY
            setGuardians(data?.data || []);
        } catch (err) {
            console.error("Error fetching guardians:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setGuardians([]);
            fetchGuardians();
        }
    }, [isOpen, studentId]);

    const debouncedSave = useMemo(
        () => debounce(async (guardian: Guardian, field: string, value: any, index: number) => {
            const key = guardian.id ? String(guardian.id) : `new-${index}`;
            setPatchingStatus(prev => ({ ...prev, [key]: 'loading' }));

            try {
                if (guardian.isNew) {
                    // Prepare the full guardian object with the new value
                    let transformedValue = value;
                    if (typeof value === 'string' && field !== 'dob' && field !== 'email_address') {
                        transformedValue = value.toUpperCase();
                    }

                    const payload: any = { ...guardian, [field]: transformedValue };

                    // 1. Strip metadata/internal fields that the CreateGuardianDto doesn't accept
                    delete payload.isNew;
                    delete payload.id;
                    delete payload.created_at;
                    delete payload.updated_at;
                    delete payload.deleted_at;

                    // 2. Validate mandatory fields for Creation
                    if (!payload.full_name?.trim() || !payload.relationship?.trim() || payload.relationship === "NULL") {
                        setPatchingStatus(prev => ({ ...prev, [key]: 'idle' }));
                        return;
                    }

                    const { data } = await api.post(`/v1/staff-editing/students/${studentId}/guardians`, payload);
                    const createdGuardian = data?.data;

                    setGuardians(prev => prev.map((g, i) => i === index ? {
                        ...createdGuardian,
                        isNew: false
                    } : g));
                    setPatchingStatus(prev => {
                        const next = { ...prev };
                        delete next[key]; // Remove temp key status
                        next[String(createdGuardian.id)] = 'success';
                        return next;
                    });

                    setTimeout(() => {
                        setPatchingStatus(prev => ({ ...prev, [String(createdGuardian.id)]: 'idle' }));
                    }, 2000);
                } else {
                    let transformedValue = value;
                    if (typeof value === 'string' && field !== 'dob' && field !== 'email_address') {
                        transformedValue = value.toUpperCase();
                    }

                    await api.patch(`/v1/staff-editing/students/${studentId}/guardians/${guardian.id}`, {
                        [field]: transformedValue
                    });
                    setPatchingStatus(prev => ({ ...prev, [key]: 'success' }));

                    setTimeout(() => {
                        setPatchingStatus(prev => ({ ...prev, [key]: 'idle' }));
                    }, 2000);
                }
            } catch (err) {
                console.error("Error saving guardian:", err);
                setPatchingStatus(prev => ({ ...prev, [key]: 'error' }));
            }
        }, 1000),
        [studentId]
    );

    const handleEdit = async (index: number, field: keyof Guardian, value: any) => {
        const guardian = guardians[index];
        // Transform "NULL" to null
        let transformedValue = value === "NULL" ? null : value;

        if (field === 'cnic') {
            transformedValue = formatNIC(value);

            // Auto-fill logic
            if (transformedValue.length === 15) {
                try {
                    const { data } = await api.get(`/v1/staff-editing/guardians/by-nic/${transformedValue}`);
                    const existing = data?.data;
                    if (existing) {
                        setGuardians(prev => prev.map((g, i) => {
                            if (i === index) {
                                return {
                                    ...g,
                                    ...existing,
                                    // Preserve relationship-specific fields
                                    relationship: g.relationship,
                                    is_primary_contact: g.is_primary_contact,
                                    is_emergency_contact: g.is_emergency_contact,
                                    isNew: g.isNew,
                                    id: g.id
                                };
                            }
                            return g;
                        }));
                    }
                } catch (err) {
                    console.error("Error auto-filling guardian:", err);
                }
            }
        } else if (field !== 'dob' && field !== 'is_primary_contact' && field !== 'is_emergency_contact' && field !== 'email_address' && typeof transformedValue === 'string') {
            transformedValue = transformedValue.toUpperCase();
        }

        // Logic for unique father
        if (field === 'relationship' && transformedValue === 'FATHER') {
            const otherFatherIndex = guardians.findIndex((g, i) => i !== index && g.relationship === 'FATHER');
            if (otherFatherIndex !== -1) {
                const otherGuardian = guardians[otherFatherIndex];
                setGuardians(prev => prev.map((g, i) => i === otherFatherIndex ? { ...g, relationship: "OTHER" } : g));
                debouncedSave(otherGuardian, 'relationship', 'OTHER', otherFatherIndex);
            }
        }

        // Logic for unique primary contact
        if (field === 'is_primary_contact' && transformedValue === true) {
            const otherPrimaryIndex = guardians.findIndex((g, i) => i !== index && g.is_primary_contact === true);
            if (otherPrimaryIndex !== -1) {
                const otherGuardian = guardians[otherPrimaryIndex];
                setGuardians(prev => prev.map((g, i) => i === otherPrimaryIndex ? { ...g, is_primary_contact: false } : g));
                debouncedSave(otherGuardian, 'is_primary_contact', false, otherPrimaryIndex);
            }
        }

        setGuardians(prev => prev.map((g, i) => i === index ? { ...g, [field]: transformedValue } : g));
        debouncedSave(guardian, field, transformedValue, index);
    };

    const handleDelete = async () => {
        if (!deleteId || !studentId) return;
        setIsDeleting(true);
        try {
            await api.delete(`/v1/staff-editing/students/${studentId}/guardians/${deleteId}`);
            setGuardians(prev => prev.filter(g => g.id !== deleteId));
            setDeleteId(null);
        } catch (err) {
            console.error("Error deleting guardian:", err);
            alert("Failed to delete guardian mapping.");
        } finally {
            setIsDeleting(false);
        }
    };

    const addRow = () => {
        setGuardians(prev => [...prev, {
            relationship: "OTHER",
            full_name: "",
            is_primary_contact: false,
            is_emergency_contact: false,
            cnic: null,
            dob: null,
            primary_phone_country_code: "+92",
            primary_phone: null,
            whatsapp_country_code: "+92",
            whatsapp_number: null,
            work_phone_country_code: "+92",
            work_phone: null,
            email_address: null,
            education_level: null,
            occupation: null,
            organization: null,
            job_position: null,
            monthly_income: null,
            work_address: null,
            mailing_address: null,
            house_appt_name: null,
            house_appt_number: null,
            area_block: null,
            country: null,
            province: null,
            city: null,
            occupational_position: null,
            place_of_birth: null,
            isNew: true
        }]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-[1200px] h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-zinc-200">
                {/* Header */}
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-lg">
                            <UserCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900">Guardian Management</h2>
                            <p className="text-sm text-zinc-500 font-medium">Viewing guardians for <span className="text-zinc-900 font-bold">{studentName}</span></p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-200 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-zinc-300" />
                            <p className="text-sm text-zinc-500 font-medium font-mono">LOADING_RECORDS...</p>
                        </div>
                    ) : (
                        <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="max-w-full overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse table-fixed">
                                    <thead>
                                        <tr className="bg-zinc-50 border-b border-zinc-200">
                                            <th className="p-3 w-16 text-center text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200 sticky left-0 bg-zinc-50 z-20">Stat</th>
                                            <th className="p-3 w-44 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200 sticky left-16 bg-zinc-50 z-20">CNIC</th>
                                            <th className="p-3 w-64 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200 sticky left-[240px] bg-zinc-50 z-20">Full Name</th>
                                            <th className="p-3 w-40 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Relationship</th>
                                            <th className="p-3 w-44 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">DOB</th>
                                            <th className="p-3 w-44 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Phone</th>
                                            <th className="p-3 w-44 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">WhatsApp</th>
                                            <th className="p-3 w-44 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Work Phone</th>
                                            <th className="p-3 w-56 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Email</th>
                                            <th className="p-3 w-48 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Education</th>
                                            <th className="p-3 w-48 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Occupation</th>
                                            <th className="p-3 w-48 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Organization</th>
                                            <th className="p-3 w-48 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Job Pos</th>
                                            <th className="p-3 w-40 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Income</th>
                                            <th className="p-3 w-64 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Work Addr</th>
                                            <th className="p-3 w-64 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Mail Addr</th>
                                            <th className="p-3 w-48 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Hse Name</th>
                                            <th className="p-3 w-32 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Hse No</th>
                                            <th className="p-3 w-48 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Area</th>
                                            <th className="p-3 w-40 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Country</th>
                                            <th className="p-3 w-40 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Province</th>
                                            <th className="p-3 w-40 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">City</th>
                                            <th className="p-3 w-40 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Occ Pos</th>
                                            <th className="p-3 w-40 text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">POB</th>
                                            <th className="p-3 w-16 text-center text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Pri</th>
                                            <th className="p-3 w-16 text-center text-zinc-500 uppercase text-[10px] font-bold tracking-widest border-r border-zinc-200">Emg</th>
                                            <th className="p-3 w-16 text-center text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Del</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {guardians.map((guardian, idx) => {
                                            const key = guardian.id ? String(guardian.id) : `new-${idx}`;
                                            const status = patchingStatus[key] || 'idle';

                                            return (
                                                <tr key={key} className="hover:bg-zinc-50/50 transition-colors group">
                                                    <td className="p-3 text-center border-r border-zinc-100 sticky left-0 bg-white group-hover:bg-zinc-50 transition-colors z-10">
                                                        {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-zinc-400 mx-auto" />}
                                                        {status === 'success' && <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />}
                                                        {status === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />}
                                                        {status === 'idle' && <div className="h-1.5 w-1.5 rounded-full bg-zinc-200 mx-auto" />}
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100 sticky left-16 bg-white group-hover:bg-zinc-50 transition-colors z-10">
                                                        <input
                                                            type="text"
                                                            value={guardian.cnic || ""}
                                                            onChange={(e) => handleEdit(idx, "cnic", e.target.value)}
                                                            placeholder="CNIC"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all font-bold truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100 sticky left-[240px] bg-white group-hover:bg-zinc-50 transition-colors z-10">
                                                        <input
                                                            type="text"
                                                            value={guardian.full_name}
                                                            onChange={(e) => handleEdit(idx, "full_name", e.target.value)}
                                                            placeholder="Full Name"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all font-bold truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        {(!RELATIONSHIP_OPTIONS.includes(guardian.relationship || "NULL") && guardian.relationship !== null) ? (
                                                            <input
                                                                type="text"
                                                                value={guardian.relationship || ""}
                                                                onChange={(e) => handleEdit(idx, "relationship", e.target.value)}
                                                                onBlur={(e) => {
                                                                    if (e.target.value === "") handleEdit(idx, "relationship", null);
                                                                }}
                                                                autoFocus
                                                                className="w-full px-2 py-2 bg-white outline-none ring-1 ring-inset ring-zinc-900 border-none rounded-md transition-all font-medium truncate"
                                                            />
                                                        ) : (
                                                            <select
                                                                value={guardian.relationship === null ? "NULL" : (RELATIONSHIP_OPTIONS.includes(guardian.relationship) ? guardian.relationship : "OTHER")}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === "OTHER") {
                                                                        handleEdit(idx, "relationship", " ");
                                                                    } else {
                                                                        handleEdit(idx, "relationship", val);
                                                                    }
                                                                }}
                                                                className="w-full px-2 py-2 bg-transparent focus:bg-white outline-none focus:ring-1 focus:ring-zinc-900 rounded-md transition-all appearance-none cursor-pointer truncate font-medium text-zinc-500"
                                                            >
                                                                {RELATIONSHIP_OPTIONS.map(opt => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.dob || ""}
                                                            onChange={(e) => handleEdit(idx, "dob", e.target.value)}
                                                            placeholder="DD/MM/YYYY"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <div className="flex border border-zinc-200 rounded-md focus-within:ring-1 focus-within:ring-zinc-900 overflow-hidden">
                                                            <input type="text" value={guardian.primary_phone_country_code || ""} onChange={(e) => handleEdit(idx, "primary_phone_country_code", e.target.value)} placeholder="+92" className="w-12 flex-shrink-0 px-1.5 py-2 bg-zinc-50 border-0 text-zinc-600 text-xs outline-none truncate" />
                                                            <input type="text" value={guardian.primary_phone || ""} onChange={(e) => handleEdit(idx, "primary_phone", e.target.value)} placeholder="Phone" className="flex-1 min-w-0 px-2 py-2 bg-transparent border-0 outline-none focus:bg-white text-zinc-600 truncate" />
                                                        </div>
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <div className="flex border border-zinc-200 rounded-md focus-within:ring-1 focus-within:ring-zinc-900 overflow-hidden">
                                                            <input type="text" value={guardian.whatsapp_country_code || ""} onChange={(e) => handleEdit(idx, "whatsapp_country_code", e.target.value)} placeholder="+92" className="w-12 flex-shrink-0 px-1.5 py-2 bg-zinc-50 border-0 text-zinc-600 text-xs outline-none truncate" />
                                                            <input type="text" value={guardian.whatsapp_number || ""} onChange={(e) => handleEdit(idx, "whatsapp_number", e.target.value)} placeholder="WhatsApp" className="flex-1 min-w-0 px-2 py-2 bg-transparent border-0 outline-none focus:bg-white text-zinc-600 truncate" />
                                                        </div>
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <div className="flex border border-zinc-200 rounded-md focus-within:ring-1 focus-within:ring-zinc-900 overflow-hidden">
                                                            <input type="text" value={guardian.work_phone_country_code || ""} onChange={(e) => handleEdit(idx, "work_phone_country_code", e.target.value)} placeholder="+92" className="w-12 flex-shrink-0 px-1.5 py-2 bg-zinc-50 border-0 text-zinc-600 text-xs outline-none truncate" />
                                                            <input type="text" value={guardian.work_phone || ""} onChange={(e) => handleEdit(idx, "work_phone", e.target.value)} placeholder="Work Phone" className="flex-1 min-w-0 px-2 py-2 bg-transparent border-0 outline-none focus:bg-white text-zinc-600 truncate" />
                                                        </div>
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="email"
                                                            value={guardian.email_address || ""}
                                                            onChange={(e) => handleEdit(idx, "email_address", e.target.value)}
                                                            placeholder="Email"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.education_level || ""}
                                                            onChange={(e) => handleEdit(idx, "education_level", e.target.value)}
                                                            placeholder="Education"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.occupation || ""}
                                                            onChange={(e) => handleEdit(idx, "occupation", e.target.value)}
                                                            placeholder="Occupation"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.organization || ""}
                                                            onChange={(e) => handleEdit(idx, "organization", e.target.value)}
                                                            placeholder="Organization"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.job_position || ""}
                                                            onChange={(e) => handleEdit(idx, "job_position", e.target.value)}
                                                            placeholder="Job Position"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.monthly_income || ""}
                                                            onChange={(e) => handleEdit(idx, "monthly_income", e.target.value)}
                                                            placeholder="Income"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.work_address || ""}
                                                            onChange={(e) => handleEdit(idx, "work_address", e.target.value)}
                                                            placeholder="Work Address"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.mailing_address || ""}
                                                            onChange={(e) => handleEdit(idx, "mailing_address", e.target.value)}
                                                            placeholder="Mailing Address"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.house_appt_name || ""}
                                                            onChange={(e) => handleEdit(idx, "house_appt_name", e.target.value)}
                                                            placeholder="House Name"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.house_appt_number || ""}
                                                            onChange={(e) => handleEdit(idx, "house_appt_number", e.target.value)}
                                                            placeholder="Hse No"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.area_block || ""}
                                                            onChange={(e) => handleEdit(idx, "area_block", e.target.value)}
                                                            placeholder="Area/Block"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        {(!COUNTRY_OPTIONS.includes(guardian.country || "NULL") && guardian.country !== null) ? (
                                                            <input
                                                                type="text"
                                                                value={guardian.country || ""}
                                                                onChange={(e) => handleEdit(idx, "country", e.target.value)}
                                                                onBlur={(e) => {
                                                                    if (e.target.value === "") handleEdit(idx, "country", null);
                                                                }}
                                                                autoFocus
                                                                className="w-full px-2 py-2 bg-white outline-none ring-1 ring-inset ring-zinc-900 border-none rounded-md transition-all text-zinc-600 truncate"
                                                            />
                                                        ) : (
                                                            <select
                                                                value={guardian.country === null ? "NULL" : (COUNTRY_OPTIONS.includes(guardian.country) ? guardian.country : "OTHER")}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === "OTHER") {
                                                                        handleEdit(idx, "country", " ");
                                                                    } else {
                                                                        handleEdit(idx, "country", val);
                                                                    }
                                                                }}
                                                                className="w-full px-2 py-2 bg-transparent focus:bg-white outline-none focus:ring-1 focus:ring-zinc-900 rounded-md transition-all appearance-none cursor-pointer text-zinc-600 truncate"
                                                            >
                                                                {COUNTRY_OPTIONS.map(opt => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        {guardian.country === "PAKISTAN" ? (
                                                            (!PAKISTAN_PROVINCES.includes(guardian.province || "NULL") && guardian.province !== null) ? (
                                                                <input
                                                                    type="text"
                                                                    value={guardian.province || ""}
                                                                    onChange={(e) => handleEdit(idx, "province", e.target.value)}
                                                                    onBlur={(e) => {
                                                                        if (e.target.value === "") handleEdit(idx, "province", null);
                                                                    }}
                                                                    autoFocus
                                                                    className="w-full px-2 py-2 bg-white outline-none ring-1 ring-inset ring-zinc-900 border-none rounded-md transition-all text-zinc-600 truncate"
                                                                />
                                                            ) : (
                                                                <select
                                                                    value={guardian.province === null ? "NULL" : (PAKISTAN_PROVINCES.includes(guardian.province) ? guardian.province : "OTHER")}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (val === "OTHER") {
                                                                            handleEdit(idx, "province", " ");
                                                                        } else {
                                                                            handleEdit(idx, "province", val);
                                                                        }
                                                                    }}
                                                                    className="w-full px-2 py-2 bg-transparent focus:bg-white outline-none focus:ring-1 focus:ring-zinc-900 rounded-md transition-all appearance-none cursor-pointer text-zinc-600 truncate"
                                                                >
                                                                    {PAKISTAN_PROVINCES.map(opt => (
                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            )
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={guardian.province || ""}
                                                                onChange={(e) => handleEdit(idx, "province", e.target.value)}
                                                                placeholder="Province"
                                                                className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.city || ""}
                                                            onChange={(e) => handleEdit(idx, "city", e.target.value)}
                                                            placeholder="City"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.occupational_position || ""}
                                                            onChange={(e) => handleEdit(idx, "occupational_position", e.target.value)}
                                                            placeholder="Occ Pos"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-zinc-100">
                                                        <input
                                                            type="text"
                                                            value={guardian.place_of_birth || ""}
                                                            onChange={(e) => handleEdit(idx, "place_of_birth", e.target.value)}
                                                            placeholder="POB"
                                                            className="w-full px-2 py-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-md transition-all text-zinc-600 truncate"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center border-r border-zinc-100">
                                                        <input
                                                            type="checkbox"
                                                            checked={guardian.is_primary_contact}
                                                            onChange={(e) => handleEdit(idx, "is_primary_contact", e.target.checked)}
                                                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center border-r border-zinc-100">
                                                        <input
                                                            type="checkbox"
                                                            checked={guardian.is_emergency_contact}
                                                            onChange={(e) => handleEdit(idx, "is_emergency_contact", e.target.checked)}
                                                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={() => {
                                                                if (guardian.id) {
                                                                    setDeleteId(guardian.id);
                                                                } else {
                                                                    setGuardians(prev => prev.filter((_, i) => i !== idx));
                                                                }
                                                            }}
                                                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                                                            title="Remove Guardian"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {guardians.length === 0 && !isLoading && (
                                <div className="p-12 text-center bg-zinc-50/30">
                                    <div className="h-20 w-20 rounded-3xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-300 mx-auto mb-6 shadow-sm">
                                        <UserPlus className="h-10 w-10" />
                                    </div>
                                    <h3 className="text-base font-bold text-zinc-900">No guardian information found</h3>
                                    <p className="text-sm text-zinc-500 mb-8 max-w-xs mx-auto">Click the button below to add the first guardian for this student.</p>
                                    <button
                                        onClick={addRow}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 active:scale-95"
                                    >
                                        <Plus className="h-5 w-5" />
                                        Add First Guardian
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-emerald-500 fill-emerald-500" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">REAL-TIME SYNC</span>
                        </div>
                        <div className="h-4 w-px bg-zinc-200 sm:block hidden"></div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest sm:block hidden">{guardians.length} Guardian{guardians.length !== 1 ? 's' : ''} Record{guardians.length !== 1 ? 's' : ''}</span>
                    </div>
                    {guardians.length > 0 && (
                        <button
                            onClick={addRow}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 text-zinc-900 rounded-2xl text-sm font-bold hover:bg-zinc-50 transition-all shadow-sm active:scale-95 border-b-2"
                        >
                            <Plus className="h-4 w-4 text-emerald-500" />
                            Add New Row
                        </button>
                    )}
                </div>

                {/* Delete Confirmation Modal */}
                {deleteId !== null && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 text-center">
                                <div className="h-14 w-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 className="h-7 w-7" />
                                </div>
                                <h2 className="text-lg font-bold text-zinc-900">Remove Guardian?</h2>
                                <p className="text-zinc-500 mt-2">
                                    This will un-link this guardian from the student. The guardian record itself will remain in the system.
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-zinc-50 flex gap-3">
                                <button
                                    onClick={() => setDeleteId(null)}
                                    className="flex-1 py-2.5 font-medium text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex-1 py-2.5 font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-all active:scale-95 shadow-sm shadow-rose-200 disabled:opacity-50"
                                >
                                    {isDeleting ? "Removing..." : "Remove"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
