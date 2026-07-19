"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  X as XIcon, Users, UserCircle, GraduationCap, Phone, Mail, 
  Building2, Plus, Trash2, Save, Loader2, CheckCircle2, 
  Search, Link as LinkIcon, User, RefreshCw, MapPin, Camera,
  Edit2, ChevronDown, ChevronUp, Pencil, UserCheck,
  Smartphone, Lock, Check, AlertCircle
} from "lucide-react";
import {
  familiesService,
  type FamilyDetail,
  type FamilyStudent,
  type FamilyGuardian,
} from "@/lib/families.service";
import api from "@/lib/api";
import { PhotoUpload } from "@/app/(dashboard)/identity/students/tabs/PhotoUpload";

interface FamilyDetailModalProps {
  familyId: number;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  SOFT_ADMISSION: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ENROLLED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPELLED: "bg-red-50 text-red-700 border-red-200",
  GRADUATED: "bg-sky-50 text-sky-700 border-sky-200",
};

const RELATIONSHIPS = ["FATHER", "MOTHER", "GUARDIAN", "UNCLE", "AUNT", "GRANDFATHER", "GRANDMOTHER", "SIBLING", "OTHER"];

const isNA = (v: any) => v === "N/A" || v === "021-N/A";
const formatCNIC = (v: string) => {
  const digits = v.replace(/\D/g, "").slice(0, 13);
  let out = digits;
  if (digits.length > 5) out = digits.slice(0, 5) + "-" + digits.slice(5);
  if (digits.length > 12) out = out.slice(0, 13) + "-" + out.slice(13);
  return out;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", className = "", showNA = false }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string; showNA?: boolean }) {
  const isEmail = type === "email";
  return (
    <div className="relative flex items-center">
      <input 
        type={type} 
        value={isNA(value) ? "N/A" : (value ?? "")}
        onChange={e => onChange(isEmail ? e.target.value.toLowerCase() : e.target.value.toUpperCase())}
        placeholder={placeholder}
        className={`w-full h-9 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all ${isEmail ? "" : "uppercase"} ${showNA ? "pr-10" : ""} ${className}`} 
      />
      {showNA && (
        <button
          type="button"
          onClick={() => onChange(isNA(value) ? "" : "N/A")}
          className={`absolute right-1.5 px-1.5 py-1 text-[9px] font-black rounded-lg transition-all ${isNA(value) ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-750"}`}
        >
          N/A
        </button>
      )}
    </div>
  );
}

function PhoneInput({ value, onChange, placeholder, className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const handlePhoneChange = (v: string) => {
    if (v === "N/A") return;
    if (!v.startsWith("+92")) {
      onChange("+92");
      return;
    }
    const rest = v.slice(3).replace(/\D/g, "").slice(0, 10);
    onChange("+92" + rest);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="text"
        value={isNA(value) ? "N/A" : (value?.startsWith("+92") ? value : ("+92" + (value || "")))}
        onChange={e => handlePhoneChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-3 pr-10 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all font-mono"
      />
      <button
        type="button"
        onClick={() => onChange(isNA(value) ? "+92" : "N/A")}
        className={`absolute right-1.5 px-1.5 py-1 text-[9px] font-black rounded-lg transition-all ${isNA(value) ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-750"}`}
      >
        N/A
      </button>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div onClick={() => onChange(!checked)} className={`relative h-4 w-8 rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-800"}`}>
        <span className={`absolute top-0.5 left-0.5 h-3 w-3 bg-white dark:bg-zinc-100 rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </div>
      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 uppercase">{label}</span>
    </label>
  );
}

const EMPTY_GUARDIAN = {
  full_name: "", cnic: "", relationship: "GUARDIAN", custom_relationship: "", primary_phone: "+92", whatsapp_number: "+92",
  occupation: "", email_address: "", is_primary_contact: false, is_emergency_contact: false,
  additional_phones: []
};

export function FamilyDetailModal({ familyId, onClose }: FamilyDetailModalProps) {
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Household Details Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempHouseholdName, setTempHouseholdName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [tempAddress, setTempAddress] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Flutter App Access Reset States
  const [newAppEmail, setNewAppEmail] = useState("");
  const [isSavingAppEmail, setIsSavingAppEmail] = useState(false);
  const [appEmailError, setAppEmailError] = useState<string | null>(null);

  const [newAppPassword, setNewAppPassword] = useState("");
  const [isSavingAppPassword, setIsSavingAppPassword] = useState(false);
  const [appPasswordError, setAppPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isWipingAppAccess, setIsWipingAppAccess] = useState(false);

  // Guardian Management State
  const [expandedGuardianId, setExpandedGuardianId] = useState<number | null>(null);
  const [addingGuardian, setAddingGuardian] = useState(false);
  const [newG, setNewG] = useState<any>({ ...EMPTY_GUARDIAN });
  const [savingGuardian, setSavingGuardian] = useState(false);
  
  // Photo state for new guardian creation
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Please select an image file");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // Selection Context for multi-student households
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // CNIC Link Existing State
  const [searchCnic, setSearchCnic] = useState("");
  const [searchingCnic, setSearchingCnic] = useState(false);
  const [foundGuardian, setFoundGuardian] = useState<any>(null);
  const [linkingGuardian, setLinkingGuardian] = useState(false);
  const [linkRel, setLinkRel] = useState("GUARDIAN");
  const [linkCustomRel, setLinkCustomRel] = useState("");
  const [isLinkPrimary, setIsLinkPrimary] = useState(false);
  const [isLinkEmergency, setIsLinkEmergency] = useState(false);

  // Structured Address State
  const [familyAddress, setFamilyAddress] = useState<any>({
    house_appt_name: "",
    area_block: "",
    city: "",
    postal_code: "",
    province: "",
    country: "",
    work_phone: "",
  });
  const [savingAddr, setSavingAddr] = useState(false);
  const [savedAddr, setSavedAddr] = useState(false);
  const [isAddrDirty, setIsAddrDirty] = useState(false);
  const [syncToHousehold, setSyncToHousehold] = useState(false);
  const [isEditingAddrCard, setIsEditingAddrCard] = useState(false);

  const reloadData = () => {
    setIsLoading(true);
    setError(null);
    familiesService
      .getById(familyId)
      .then((data) => {
        setFamily(data);
        setNewAppEmail(data.email || "");
        setNewAppPassword("");
        if (data.students && data.students.length > 0) {
          setSelectedStudentId(data.students[0].cc);
        }
        
        // Initialize structured family address from the first guardian (same as student directory)
        if (data.guardians && data.guardians.length > 0) {
          const g = data.guardians[0] as any;
          setFamilyAddress({
            house_appt_name: g.house_appt_name || "",
            area_block: g.area_block || "",
            city: g.city || "",
            postal_code: g.postal_code || "",
            province: g.province || "",
            country: g.country || "",
            work_phone: data.home_phone || g.work_phone || "",
          });
          setIsAddrDirty(false);
        }
      })
      .catch(() => setError("Failed to load family details."))
      .finally(() => setIsLoading(false));
  };

  const handleResetEmail = async () => {
    if (!newAppEmail.trim()) {
      setAppEmailError("Email cannot be empty");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAppEmail)) {
      setAppEmailError("Please enter a valid email address");
      return;
    }

    setIsSavingAppEmail(true);
    setAppEmailError(null);
    try {
      await familiesService.update(familyId, { email: newAppEmail.toLowerCase().trim() });
      reloadData();
    } catch (err: any) {
      setAppEmailError(err?.response?.data?.message || "Failed to update email");
    } finally {
      setIsSavingAppEmail(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newAppPassword) {
      setAppPasswordError("Password cannot be empty");
      return;
    }
    if (newAppPassword.length < 6) {
      setAppPasswordError("Password must be at least 6 characters");
      return;
    }

    setIsSavingAppPassword(true);
    setAppPasswordError(null);
    try {
      await familiesService.update(familyId, { password: newAppPassword });
      setNewAppPassword("");
      alert("App password reset successfully!");
      reloadData();
    } catch (err: any) {
      setAppPasswordError(err?.response?.data?.message || "Failed to reset password");
    } finally {
      setIsSavingAppPassword(false);
    }
  };

  const handleWipeAppAccess = async () => {
    if (!window.confirm("Are you sure you want to wipe this family's app access credentials (email and password)? This will log them out of the app.")) {
      return;
    }
    setIsWipingAppAccess(true);
    try {
      await familiesService.update(familyId, { email: null, password: null });
      setNewAppEmail("");
      setNewAppPassword("");
      alert("App credentials wiped successfully!");
      reloadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to wipe app credentials");
    } finally {
      setIsWipingAppAccess(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, [familyId]);

  const handleUpdateHouseholdName = async () => {
    if (!tempHouseholdName.trim()) return alert("Household name cannot be empty");
    setIsSavingName(true);
    try {
      await api.patch(`/v1/families/${familyId}`, { household_name: tempHouseholdName.toUpperCase() });
      setIsEditingName(false);
      reloadData();
    } catch {
      alert("Failed to update household name");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleUpdateAddress = async () => {
    setIsSavingAddress(true);
    try {
      await api.patch(`/v1/families/${familyId}`, { primary_address: tempAddress });
      setIsEditingAddress(false);
      reloadData();
    } catch {
      alert("Failed to update family address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleUpdateEmail = async () => {
    setIsSavingEmail(true);
    try {
      await api.patch(`/v1/families/${familyId}`, { email: tempEmail });
      setIsEditingEmail(false);
      reloadData();
    } catch {
      alert("Failed to update family email");
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSearchCnic = async () => {
    if (!searchCnic || searchCnic.length < 15) return;
    setSearchingCnic(true);
    setFoundGuardian(null);
    try {
      const { data } = await api.get(`/v1/staff-editing/guardians/by-nic/${searchCnic}`);
      if (data?.data) {
        const isLinked = family?.guardians?.some(g => g.id === data.data.id);
        if (isLinked) {
          alert("This guardian is already linked to this household.");
        } else {
          setFoundGuardian(data.data);
        }
      } else {
        alert("No guardian found with this CNIC.");
      }
    } catch {
      alert("Error searching for guardian.");
    } finally { setSearchingCnic(false); }
  };

  const handleLinkExisting = async () => {
    if (!foundGuardian || !selectedStudentId) return;

    let relationshipToSave = linkRel.toUpperCase();
    if (relationshipToSave === "OTHER" && linkCustomRel) {
      relationshipToSave = linkCustomRel.toUpperCase();
    }

    setLinkingGuardian(true);
    try {
      await api.post(`/v1/staff-editing/students/${selectedStudentId}/guardians/link-existing`, {
        guardian_id: foundGuardian.id,
        relationship: relationshipToSave,
        is_primary_contact: isLinkPrimary,
        is_emergency_contact: isLinkEmergency
      });
      setFoundGuardian(null);
      setSearchCnic("");
      setLinkCustomRel("");
      reloadData();
    } catch {
      alert("Failed to link guardian.");
    } finally { setLinkingGuardian(false); }
  };

  const handleCreateGuardian = async () => {
    if (!selectedStudentId) return alert("Please select a student context first.");
    if (!newG.full_name || !newG.relationship) return alert("Full name and relationship are required");
    
    let relationshipToSave = newG.relationship.toUpperCase();
    if (relationshipToSave === "OTHER" && newG.custom_relationship) {
      relationshipToSave = newG.custom_relationship.toUpperCase();
    }

    setSavingGuardian(true);
    try {
      const { data } = await api.post(`/v1/staff-editing/students/${selectedStudentId}/guardians`, {
        ...newG,
        relationship: relationshipToSave,
      });

      const guardianId = data?.data?.guardian_id || data?.data?.id;
      if (photoFile && guardianId) {
        const fd = new FormData();
        fd.append("file", photoFile);
        await api.post(`/v1/media/guardian/${guardianId}/photo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }

      setAddingGuardian(false);
      setNewG({ ...EMPTY_GUARDIAN });
      setPhotoFile(null);
      setPhotoPreview(null);
      reloadData();
    } catch {
      alert("Failed to add new guardian");
    } finally { setSavingGuardian(false); }
  };

  const handleSaveFamilyAddress = async () => {
    if (!selectedStudentId) return alert("Please select a student context first.");
    setSavingAddr(true);
    try {
      await api.patch(`/v1/staff-editing/students/${selectedStudentId}/family-address`, {
        ...familyAddress,
        bulk_sync: syncToHousehold,
      });
      setSavedAddr(true);
      setTimeout(() => {
        setSavedAddr(false);
        setIsEditingAddrCard(false);
      }, 2500);
      setIsAddrDirty(false);
      reloadData();
    } catch {
      alert("Failed to update family address");
    } finally {
      setSavingAddr(false);
    }
  };

  // Health Score calculation helper
  const getHealthScore = () => {
    if (!family) return 0;
    let score = 0;
    const f = family.guardians?.find(g => g.relationship?.toUpperCase() === "FATHER");
    const m = family.guardians?.find(g => g.relationship?.toUpperCase() === "MOTHER");
    const has = (v: any) => v && v !== "N/A" && v !== "NOT PROVIDED" && v.toString().trim() !== "";

    if (has(f?.full_name)) score += 15;
    if (has(f?.cnic)) score += 10;
    if (has(f?.primary_phone)) score += 10;

    if (has(m?.full_name)) score += 15;
    if (has(m?.cnic)) score += 10;
    if (has(m?.primary_phone)) score += 10;

    if (has(family.primary_address)) score += 30;

    return Math.min(score, 100);
  };

  const score = getHealthScore();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

        {/* Gradient Header */}
        <div className="relative h-28 bg-gradient-to-r from-indigo-600 to-blue-700 p-6 flex flex-col justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>

          <div className="flex items-end gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white border border-white/30 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={tempHouseholdName}
                    onChange={e => setTempHouseholdName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleUpdateHouseholdName()}
                    className="h-8 px-2 text-[14px] font-bold text-zinc-900 bg-white border border-white/80 rounded-lg outline-none uppercase"
                  />
                  <button onClick={handleUpdateHouseholdName} disabled={isSavingName} className="px-3 h-8 text-[10px] font-black uppercase bg-white text-indigo-700 rounded-lg hover:bg-white/90">
                    {isSavingName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </button>
                  <button onClick={() => setIsEditingName(false)} className="px-3 h-8 text-[10px] font-black uppercase bg-white/20 text-white rounded-lg">Cancel</button>
                </div>
              ) : (
                <div className="group flex items-center gap-2 cursor-pointer" onClick={() => { setTempHouseholdName(family?.household_name || ""); setIsEditingName(true); }}>
                  <h3 className="font-extrabold text-lg text-white leading-tight uppercase tracking-tight group-hover:text-white/80">
                    {family?.household_name ?? "Family Profile"}
                  </h3>
                  <span className="text-[10px] text-white/60 opacity-0 group-hover:opacity-100">✏️</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-white/70 font-bold">FAMILY ID: #{familyId}</span>
                {family && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-lg">
                    <div className="h-1.5 w-16 bg-white/20 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${score > 80 ? "bg-emerald-400" : score > 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-[9px] font-black text-white/70">{score}% Complete</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-6 space-y-6">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mt-4">Loading family data...</p>
              </div>
            )}
            {error && (
              <div className="py-12 text-center text-red-500 text-sm">{error}</div>
            )}

            {family && !isLoading && (
              <>
                {/* Household Info Box */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 shadow-sm rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-indigo-500" /> Household Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative group">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Email Address</p>
                      {isEditingEmail ? (
                        <div className="flex items-center gap-1.5">
                          <input value={tempEmail} onChange={e => setTempEmail(e.target.value)} className="h-7 px-2 border rounded text-xs w-full outline-none focus:border-indigo-500" />
                          <button onClick={handleUpdateEmail} className="px-2 h-7 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700">Save</button>
                          <button onClick={() => setIsEditingEmail(false)} className="px-2 h-7 bg-zinc-200 text-zinc-500 rounded text-[10px] font-bold">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{family.email ?? "Not provided"}</p>
                          <button className="text-xs opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-opacity" onClick={() => { setTempEmail(family.email ?? ""); setIsEditingEmail(true); }}>✏️</button>
                        </div>
                      )}
                    </div>
                    <div className="relative group">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Primary Address</p>
                      {isEditingAddress ? (
                        <div className="flex items-center gap-1.5">
                          <textarea value={tempAddress} onChange={e => setTempAddress(e.target.value)} rows={1} className="px-2 py-1 border rounded text-xs w-full outline-none resize-none focus:border-indigo-500" />
                          <button onClick={handleUpdateAddress} className="px-2 h-7 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700">Save</button>
                          <button onClick={() => setIsEditingAddress(false)} className="px-2 h-7 bg-zinc-200 text-zinc-500 rounded text-[10px] font-bold">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{family.primary_address ?? "Not provided"}</p>
                          <button className="text-xs opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-opacity" onClick={() => { setTempAddress(family.primary_address ?? ""); setIsEditingAddress(true); }}>✏️</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Flutter App Access & Registration */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 shadow-sm rounded-xl p-5 border border-zinc-150 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-violet-500" /> Flutter App Access & Registration
                    </h3>
                    <div className="flex items-center gap-2">
                      {family.email && family.has_password ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-255 rounded-full dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Registered & Signed In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-zinc-505 bg-zinc-100 border border-zinc-200 rounded-full dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-405"></span>
                          Not Registered
                        </span>
                      )}
                      {(family.email || family.has_password) && (
                        <button
                          onClick={handleWipeAppAccess}
                          disabled={isWipingAppAccess}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 transition-all dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 disabled:opacity-50"
                          title="Wipe email and password"
                        >
                          {isWipingAppAccess ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Wipe Access
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Info & Email Reset */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Registered Email Address</p>
                        <p className="text-sm font-bold text-zinc-850 dark:text-zinc-200 tracking-wide font-mono select-all">
                          {family.email || <span className="text-zinc-400 italic font-sans font-normal">No email registered</span>}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">Reset Registered Email</p>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                            <input
                              type="email"
                              placeholder="new.email@example.com"
                              value={newAppEmail}
                              onChange={(e) => {
                                setNewAppEmail(e.target.value);
                                setAppEmailError(null);
                              }}
                              className="w-full h-9 pl-9 pr-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all lowercase"
                            />
                          </div>
                          <button
                            onClick={handleResetEmail}
                            disabled={isSavingAppEmail || !newAppEmail.trim() || newAppEmail === family.email}
                            className="px-4 h-9 bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 text-[11px] font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                          >
                            {isSavingAppEmail ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Update Email
                          </button>
                        </div>
                        {appEmailError && (
                          <p className="text-[11px] text-red-500 mt-1 font-semibold">{appEmailError}</p>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Password Reset */}
                    <div className="space-y-4 md:border-l md:border-zinc-100 md:dark:border-zinc-800 md:pl-6">
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">App Password Status</p>
                        <p className="text-sm font-bold text-zinc-850 dark:text-zinc-200">
                          {family.has_password ? (
                            <span className="text-emerald-600 dark:text-emerald-450 flex items-center gap-1">
                              <Check className="h-4 w-4" /> Password Configured
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                              <AlertCircle className="h-4 w-4" /> Password Not Configured
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">Reset App Password</p>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder="New password (min 6 chars)"
                              value={newAppPassword}
                              onChange={(e) => {
                                setNewAppPassword(e.target.value);
                                setAppPasswordError(null);
                              }}
                              className="w-full h-9 pl-9 pr-8 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650"
                            >
                              {showPassword ? "🙈" : "👁️"}
                            </button>
                          </div>
                          <button
                            onClick={handleResetPassword}
                            disabled={isSavingAppPassword || !newAppPassword || newAppPassword.length < 6}
                            className="px-4 h-9 bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 text-[11px] font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                          >
                            {isSavingAppPassword ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Update Password
                          </button>
                        </div>
                        {appPasswordError && (
                          <p className="text-[11px] text-red-500 mt-1 font-semibold">{appPasswordError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enrolled Students Box */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 shadow-sm rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-emerald-500" /> Enrolled Students ({family.students.length})
                  </h3>
                  {family.students.length === 0 ? (
                    <p className="text-sm text-zinc-400 italic">No students linked to this family.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {family.students.map((s: FamilyStudent) => (
                        <StudentRow key={s.cc} student={s} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Family Mailing Address Box */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 shadow-sm rounded-xl p-5 relative">
                  <div className="absolute top-4 right-4">
                    {isEditingAddrCard ? (
                      <button onClick={() => { setIsEditingAddrCard(false); reloadData(); }} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><XIcon className="h-4 w-4" /></button>
                    ) : (
                      <button onClick={() => setIsEditingAddrCard(true)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400"><Pencil className="h-4 w-4" /></button>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-500" /> Family Mailing Address
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-4">This address applies to father, mother, and all guardians</p>

                  {family.primary_address && (
                    <div className="mb-4 p-3 bg-zinc-100/60 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
                      <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider mb-1">Active Family Address</p>
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase">{family.primary_address}</p>
                    </div>
                  )}

                  {isEditingAddrCard ? (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <Toggle label="Apply to all household members" checked={syncToHousehold} onChange={setSyncToHousehold} />
                        <button
                          onClick={handleSaveFamilyAddress}
                          disabled={savingAddr}
                          className="flex items-center gap-1.5 px-4 h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold rounded-xl shadow-sm uppercase tracking-wider"
                        >
                          {savingAddr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedAddr ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                          {savingAddr ? "..." : savedAddr ? "Saved" : "Save All Addresses"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="House / Apartment Name and No.">
                          <Input value={familyAddress.house_appt_name} onChange={v => { setFamilyAddress((p: any) => ({ ...p, house_appt_name: v })); setIsAddrDirty(true); }} />
                        </Field>
                        <Field label="Area and Block #">
                          <Input value={familyAddress.area_block} onChange={v => { setFamilyAddress((p: any) => ({ ...p, area_block: v })); setIsAddrDirty(true); }} />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 col-span-1 md:col-span-2">
                          <Field label="City">
                            <Input value={familyAddress.city} onChange={v => { setFamilyAddress((p: any) => ({ ...p, city: v })); setIsAddrDirty(true); }} />
                          </Field>
                          <Field label="Postal Code">
                            <Input value={familyAddress.postal_code} onChange={v => { setFamilyAddress((p: any) => ({ ...p, postal_code: v })); setIsAddrDirty(true); }} />
                          </Field>
                          <Field label="Province">
                            <Input value={familyAddress.province} onChange={v => { setFamilyAddress((p: any) => ({ ...p, province: v })); setIsAddrDirty(true); }} />
                          </Field>
                          <Field label="Country">
                            <Input value={familyAddress.country} onChange={v => { setFamilyAddress((p: any) => ({ ...p, country: v })); setIsAddrDirty(true); }} />
                          </Field>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                          <Field label="Family Home Phone #">
                            <PhoneInput value={familyAddress.work_phone} onChange={v => { setFamilyAddress((p: any) => ({ ...p, work_phone: v })); setIsAddrDirty(true); }} />
                          </Field>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 animate-in fade-in duration-200">
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">House / Apartment Name and No.</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{familyAddress.house_appt_name || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Area and Block #</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{familyAddress.area_block || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">City</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{familyAddress.city || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Postal Code</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{familyAddress.postal_code || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Province</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{familyAddress.province || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Country</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{familyAddress.country || "N/A"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Family Home Phone #</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {isNA(familyAddress.work_phone) ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-600 text-white rounded-md uppercase">N/A</span>
                          ) : (
                            familyAddress.work_phone || "N/A"
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Student Context Selection for link / add */}
                {family.students.length > 1 && (
                  <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-400 uppercase">Target Student Context:</span>
                    <select
                      value={selectedStudentId ?? ""}
                      onChange={e => setSelectedStudentId(Number(e.target.value))}
                      className="h-8 px-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-lg outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200 font-medium"
                    >
                      {family.students.map(s => (
                        <option key={s.cc} value={s.cc}>{s.full_name} (CC {s.cc})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Guardians Box */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 shadow-sm rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-500" /> Guardians ({family.guardians.length})
                    </h3>
                    <button onClick={() => setAddingGuardian(!addingGuardian)} className="flex items-center gap-1 px-3 h-8 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add Guardian
                    </button>
                  </div>

                  {/* Search & Link Guardian */}
                  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 space-y-3 mb-4">
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Link Existing Guardian</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Input
                          value={searchCnic}
                          onChange={v => setSearchCnic(formatCNIC(v))}
                          placeholder="SEARCH BY CNIC (xxxxx-xxxxxxx-x)"
                          className="pl-9"
                        />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      </div>
                      <button
                        onClick={handleSearchCnic}
                        disabled={searchingCnic || searchCnic.length < 15}
                        className="px-4 h-9 bg-zinc-900 dark:bg-zinc-800 text-white text-[11px] font-bold rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      >
                        {searchingCnic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "SEARCH"}
                      </button>
                    </div>

                    {foundGuardian && (
                      <div className="mt-4 bg-white dark:bg-zinc-950 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase">{foundGuardian.full_name}</h4>
                        <p className="text-[10px] font-bold text-zinc-400 mt-0.5">{foundGuardian.cnic}</p>

                        <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                          <Field label="Relationship">
                            <select value={linkRel} onChange={e => setLinkRel(e.target.value)} className="w-full h-9 px-3 text-[13px] font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 uppercase">
                              {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </Field>
                          {linkRel === "OTHER" && (
                            <Field label="Specify Relationship">
                              <Input value={linkCustomRel} onChange={setLinkCustomRel} placeholder="e.g. DRIVER, TUTOR" showNA />
                            </Field>
                          )}
                          <div className="flex items-center gap-3 pt-4 col-span-2">
                            <Toggle label="Primary" checked={isLinkPrimary} onChange={setIsLinkPrimary} />
                            <Toggle label="Emergency" checked={isLinkEmergency} onChange={setIsLinkEmergency} />
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button onClick={handleLinkExisting} disabled={linkingGuardian} className="flex items-center gap-1.5 px-4 h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold rounded-xl shadow-sm uppercase tracking-wider transition-all">
                            {linkingGuardian ? <Loader2 className="h-3 w-3 animate-spin" /> : <LinkIcon className="h-3 w-3" />}
                            {linkingGuardian ? "Linking..." : "Link Guardian"}
                          </button>
                          <button onClick={() => setFoundGuardian(null)} className="px-3 h-8 text-[11px] font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add new Guardian Form */}
                  {addingGuardian && (
                    <div className="bg-white dark:bg-zinc-900/50 border border-indigo-100/50 dark:border-indigo-800/30 rounded-xl p-4 space-y-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">New Guardian</p>

                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Photo Picker */}
                        <div className="shrink-0">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Profile Picture</label>
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative group w-32 h-40 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-indigo-500/50 cursor-pointer shadow-sm"
                          >
                            {photoPreview ? (
                              <>
                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Camera className="h-6 w-6 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-zinc-400 group-hover:text-indigo-500 transition-colors">
                                <Camera className="h-8 w-8" />
                                <span className="text-[10px] font-black uppercase">Upload</span>
                              </div>
                            )}
                            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoSelect} />
                          </div>
                        </div>

                        {/* Form Fields */}
                        <div className="flex-1 space-y-5">
                          <div className="flex gap-6 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                            <Toggle label="Primary Contact" checked={newG.is_primary_contact} onChange={v => setNewG((p: any) => ({ ...p, is_primary_contact: v }))} />
                            <Toggle label="Emergency Contact" checked={newG.is_emergency_contact} onChange={v => setNewG((p: any) => ({ ...p, is_emergency_contact: v }))} />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <Field label="Full Name"><Input value={newG.full_name} onChange={v => setNewG((p: any) => ({ ...p, full_name: v }))} showNA /></Field>
                            </div>

                            <Field label="CNIC">
                              <Input value={newG.cnic} onChange={v => setNewG((p: any) => ({ ...p, cnic: formatCNIC(v) }))} placeholder="xxxxx-xxxxxxx-x" />
                            </Field>

                            <Field label="Relationship">
                              <select
                                value={RELATIONSHIPS.filter(r => r !== "OTHER").includes((newG.relationship || "").toUpperCase()) ? (newG.relationship || "").toUpperCase() : "OTHER"}
                                onChange={e => setNewG((p: any) => ({ ...p, relationship: e.target.value.toUpperCase() }))}
                                className="w-full h-9 px-3 text-[13px] font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 appearance-none uppercase"
                              >
                                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </Field>

                            {(!RELATIONSHIPS.filter(r => r !== "OTHER").includes((newG.relationship || "").toUpperCase())) && (
                              <div className="md:col-span-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Field label="Specify Relationship">
                                  <Input value={newG.relationship === "OTHER" ? "" : newG.relationship} onChange={v => setNewG((p: any) => ({ ...p, relationship: v }))} placeholder="e.g. DRIVER, TUTOR" showNA />
                                </Field>
                              </div>
                            )}

                            <Field label="Phone">
                              <PhoneInput value={newG.primary_phone} onChange={v => setNewG((p: any) => ({ ...p, primary_phone: v }))} />
                            </Field>

                            <Field label="WhatsApp">
                              <PhoneInput value={newG.whatsapp_number} onChange={v => setNewG((p: any) => ({ ...p, whatsapp_number: v }))} />
                            </Field>

                            <Field label="Occupation">
                              <Input value={newG.occupation} onChange={v => setNewG((p: any) => ({ ...p, occupation: v }))} />
                            </Field>

                            <Field label="Email">
                              <Input type="email" value={newG.email_address} onChange={v => setNewG((p: any) => ({ ...p, email_address: v }))} />
                            </Field>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button onClick={handleCreateGuardian} disabled={savingGuardian} className="flex items-center gap-1.5 px-4 h-8 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm">
                          {savingGuardian ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                          {savingGuardian ? "Submitting..." : "Add Guardian"}
                        </button>
                        <button onClick={() => { setAddingGuardian(false); setPhotoFile(null); setPhotoPreview(null); }} className="px-3 h-8 text-[11px] font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Guardians list items */}
                  <div className="space-y-2">
                    {family.guardians.map((g: FamilyGuardian) => (
                      <GuardianCard
                        key={g.id}
                        studentCc={selectedStudentId || 0}
                        guardian={g}
                        expanded={expandedGuardianId === g.id}
                        onToggle={() => setExpandedGuardianId(expandedGuardianId === g.id ? null : g.id)}
                        onReload={reloadData}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t flex justify-end items-center gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 h-10 text-[13px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function proxyUrl(url?: string | null) {
  if (!url) return null;
  const sanitized = url.replace(/([^:])\/\//g, "$1/");
  return `/api/v1/media/proxy?url=${encodeURIComponent(sanitized)}`;
}

function StudentRow({ student }: { student: FamilyStudent }) {
  const [imgError, setImgError] = useState(false);
  const statusStyle =
    STATUS_STYLES[student.status] ?? "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800";

  const studentName = student.full_name || "Unknown Student";
  const initial = studentName.charAt(0).toUpperCase();
  const photo = proxyUrl(student.photograph_url);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm hover:border-emerald-500/30 transition-all">
      <div className="flex items-center gap-3">
        {photo && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={studentName}
            onError={() => setImgError(true)}
            className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
            {initial}
          </div>
        )}
        <div>
          <a
            href={`/identity/students?cc=${student.cc}`}
            className="font-medium text-zinc-800 dark:text-zinc-200 text-sm hover:text-emerald-600 hover:underline transition-colors"
          >
            {studentName}
          </a>
          <p className="text-xs text-zinc-400">
            CC: {student.cc} · {student.campuses?.campus_name ?? "No campus"}
          </p>
        </div>
      </div>
      <span
        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${statusStyle}`}
      >
        {student.status.replace("_", " ")}
      </span>
    </div>
  );
}

function GuardianAvatar({ name, photoUrl, isPrimary }: { name: string; photoUrl?: string | null; isPrimary: boolean }) {
  const [imgError, setImgError] = useState(false);
  const proxied = proxyUrl(photoUrl);
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 overflow-hidden ${isPrimary ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
      {proxied && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proxied} alt="" onError={() => setImgError(true)} className="h-full w-full object-cover" />
      ) : (
        (name || "?")[0]?.toUpperCase()
      )}
    </div>
  );
}

function GuardianCard({
  studentCc, guardian, expanded, onToggle, onReload
}: {
  studentCc: number; guardian: any; expanded: boolean; onToggle: () => void; onReload: () => void
}) {
  const [local, setLocal] = useState(guardian);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setLocal(guardian);
  }, [guardian]);

  const setFieldVal = (k: string, v: any) => setLocal((p: any) => ({ ...p, [k]: v }));

  const isInfoDirty = (local.full_name || "") !== (guardian.full_name || "") ||
      (local.cnic || "") !== (guardian.cnic || "") ||
      (local.primary_phone || "") !== (guardian.primary_phone || "") ||
      (local.whatsapp_number || "") !== (guardian.whatsapp_number || "") ||
      (local.occupation || "") !== (guardian.occupation || "") ||
      (local.email_address || "") !== (guardian.email_address || "") ||
      JSON.stringify(local.additional_phones || []) !== JSON.stringify(guardian.additional_phones || []);

  const isRelDirty = (local.relationship || "") !== (guardian.relationship || "") ||
      !!local.is_primary_contact !== !!guardian.is_primary_contact ||
      !!local.is_emergency_contact !== !!guardian.is_emergency_contact;

  const handleSave = async () => {
    if (!isInfoDirty && !isRelDirty) return;
    setSaving(true);
    try {
      const promises = [];
      if (isInfoDirty) {
        promises.push(
          api.patch(`/v1/staff-editing/guardians/${guardian.id}`, {
            full_name: local.full_name,
            cnic: local.cnic,
            primary_phone: local.primary_phone,
            whatsapp_number: local.whatsapp_number,
            occupation: local.occupation,
            email_address: local.email_address,
            additional_phones: local.additional_phones || []
          })
        );
      }
      if (isRelDirty && studentCc) {
        promises.push(
          api.patch(`/v1/staff-editing/students/${studentCc}/guardians/${guardian.id}`, {
            relationship: local.relationship.toUpperCase(),
            is_primary_contact: local.is_primary_contact,
            is_emergency_contact: local.is_emergency_contact,
          })
        );
      }
      await Promise.all(promises);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onReload();
    } catch {
      alert("Failed to save changes");
    } finally { setSaving(false); }
  };

  const handleUnlink = async () => {
    if (!confirm("Are you sure you want to unlink this guardian?")) return;
    setRemoving(true);
    try {
      await api.delete(`/v1/staff-editing/students/${studentCc}/guardians/${guardian.id}`);
      onReload();
    } catch {
      alert("Failed to unlink guardian");
    } finally { setRemoving(false); }
  };

  const isPrimary = local.is_primary_contact;
  const isEmergency = local.is_emergency_contact;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${isPrimary ? "border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 shadow-sm ring-1 ring-emerald-500/5" : "border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900"}`}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={onToggle}>
        <GuardianAvatar name={local.full_name} photoUrl={local.photo_url} isPrimary={isPrimary} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 truncate uppercase">{local.full_name || "UNNAMED"}</p>
            {(isInfoDirty || isRelDirty) && <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/35 text-amber-600 dark:text-amber-400 rounded uppercase">Dirty</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase">{local.relationship ?? "Guardian"}</span>
            {isPrimary && <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-800 rounded-md uppercase">Primary</span>}
            {isEmergency && <span className="text-[9px] font-black px-1.5 py-0.5 bg-rose-650 dark:bg-rose-955 text-white rounded-md uppercase">Emergency Contact</span>}
            {local.cnic && <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded-md"><User className="h-2.5 w-2.5" />{local.cnic}</span>}
            {local.primary_phone && (
              <span className={`flex items-center gap-1 text-[10px] font-bold ${isEmergency && !(local.additional_phones || []).some((p: any) => p.label?.toUpperCase().includes("EMERGENCY")) ? "text-rose-600" : "text-zinc-400"}`}>
                <Phone className="h-2.5 w-2.5" />{local.primary_phone}
              </span>
            )}
            {(local.additional_phones || []).filter((p: any) => p.label?.toUpperCase().includes("EMERGENCY")).map((p: any, i: number) => (
              <span key={i} className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-md">
                <Phone className="h-2.5 w-2.5" />{p.number} ({p.label.replace(/\(EMERGENCY\)/gi, "").trim() || "Emergency"})
              </span>
            ))}
          </div>
        </div>
        <span className="text-zinc-300 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4 pt-4 bg-zinc-50/20 dark:bg-zinc-900/20">
          <div className="flex gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <button 
              onClick={handleSave} 
              disabled={saving || (saved && !isInfoDirty && !isRelDirty)} 
              className={`flex items-center gap-1.5 px-4 h-8 text-[11px] font-bold text-white rounded-xl transition-all ${saved ? "bg-emerald-650" : "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"}`}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              {saving ? "Submitting..." : saved ? "Submitted" : "Save Changes"}
            </button>
            <button 
              onClick={handleUnlink} 
              disabled={removing} 
              className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-rose-605 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 rounded-xl disabled:opacity-50 transition-all"
            >
              {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Unlink
            </button>
          </div>
          
          {/* Relationship & Flags */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-zinc-450 uppercase tracking-widest">Relationship & Flags</p>
              {isRelDirty && !saved && <span className="text-[9px] font-bold text-amber-600">Unsaved changes</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Relationship">
                  <select 
                    value={RELATIONSHIPS.filter(r => r !== "OTHER").includes((local.relationship || "").toUpperCase()) ? (local.relationship || "").toUpperCase() : "OTHER"} 
                    onChange={e => setFieldVal("relationship", e.target.value.toUpperCase())} 
                    className="w-full h-9 px-3 text-[13px] font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500 appearance-none uppercase"
                  >
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                {(!RELATIONSHIPS.filter(r => r !== "OTHER").includes((local.relationship || "").toUpperCase())) && (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Field label="Specify Relationship">
                      <Input value={local.relationship === "OTHER" ? "" : local.relationship} onChange={v => setFieldVal("relationship", v)} placeholder="e.g. DRIVER, TUTOR" showNA />
                    </Field>
                  </div>
                )}
              </div>
              <Toggle label="Primary Contact" checked={!!local.is_primary_contact} onChange={v => setFieldVal("is_primary_contact", v)} />
              <Toggle label="Emergency Contact" checked={!!local.is_emergency_contact} onChange={v => setFieldVal("is_emergency_contact", v)} />
            </div>
          </div>

          {/* Personal Information */}
          <div className="border-t border-zinc-100 dark:border-zinc-850 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-zinc-450 uppercase tracking-widest">Personal Information</p>
              {isInfoDirty && !saved && <span className="text-[9px] font-bold text-amber-600">Unsaved changes</span>}
            </div>

            <div className="pb-2 border-b border-zinc-50 dark:border-zinc-850 mb-1">
              <PhotoUpload guardianId={local.id} currentUrl={local.photo_url} label="Profile Picture" onSuccess={onReload} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Full Name"><Input value={local.full_name ?? ""} onChange={v => setFieldVal("full_name", v)} showNA /></Field>
              </div>
              <Field label="CNIC"><Input value={local.cnic ?? ""} onChange={v => setFieldVal("cnic", formatCNIC(v))} placeholder="xxxxx-xxxxxxx-x" /></Field>
              <Field label="Occupation"><Input value={local.occupation ?? ""} onChange={v => setFieldVal("occupation", v)} /></Field>
              <Field label="Phone"><PhoneInput value={local.primary_phone ?? ""} onChange={v => setFieldVal("primary_phone", v)} /></Field>
              <Field label="WhatsApp"><PhoneInput value={local.whatsapp_number ?? ""} onChange={v => setFieldVal("whatsapp_number", v)} /></Field>
              <div className="col-span-2">
                <Field label="Email"><Input type="email" value={local.email_address ?? ""} onChange={v => setFieldVal("email_address", v)} /></Field>
              </div>
            </div>

            {/* Additional Phone Numbers */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-zinc-450 uppercase tracking-widest">Additional Numbers</p>
                <button
                  type="button"
                  onClick={() => {
                    const current = local.additional_phones || [];
                    if (current.length >= 10) return;
                    setFieldVal("additional_phones", [...current, { label: "", number: "+92" }]);
                  }}
                  disabled={(local.additional_phones || []).length >= 10}
                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg hover:bg-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="h-3 w-3" /> Add Number
                </button>
              </div>
              <div className="space-y-2">
                {(local.additional_phones || []).map((ph: any, idx: number) => (
                  <div key={idx} className="flex gap-2 items-end group animate-in slide-in-from-right-2 duration-200">
                    <div className="flex-1">
                      <Input
                        value={ph.label}
                        onChange={v => {
                          const updated = [...(local.additional_phones || [])];
                          updated[idx] = { ...updated[idx], label: v };
                          setFieldVal("additional_phones", updated);
                        }}
                        placeholder="LABEL (E.G. OFFICE)"
                      />
                    </div>
                    <div className="flex-[1.5]">
                      <PhoneInput
                        value={ph.number}
                        onChange={v => {
                          const updated = [...(local.additional_phones || [])];
                          updated[idx] = { ...updated[idx], number: v };
                          setFieldVal("additional_phones", updated);
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (local.additional_phones || []).filter((_: any, i: number) => i !== idx);
                        setFieldVal("additional_phones", updated);
                      }}
                      className="h-9 w-9 flex items-center justify-center text-rose-500 bg-rose-50 dark:bg-rose-950/30 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {(!local.additional_phones || local.additional_phones.length === 0) && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-550 italic py-2 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">No additional numbers saved.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
