"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Loader2, User, Briefcase, Clock, BookOpen, Edit2, Trash2,
  Phone, Mail, MapPin, CreditCard, Cake, Calendar, Building2,
  AlertTriangle, Users as UsersIcon,
} from "lucide-react";
import { hrService, EmployeeProfile } from "@/lib/hr.service";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "schedule", label: "Schedule & Pay", icon: Clock },
  { id: "classes", label: "Class & Sections", icon: BookOpen },
] as const;

type TabId = typeof TABS[number]["id"];

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(value: string | null) {
  if (!value) return null;
  const match = value.match(/T?(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

function fmtMoney(value: number | null) {
  if (value == null) return null;
  return `₨ ${Number(value).toLocaleString()}`;
}

function Field({ icon: Icon, label, value, missing }: { icon: any; label: string; value: React.ReactNode; missing?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
        {missing ? (
          <p className="text-sm font-medium text-amber-500 flex items-center gap-1 mt-0.5">
            <AlertTriangle className="h-3 w-3" /> Not provided
          </p>
        ) : (
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5 break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

interface Props {
  employee: EmployeeProfile | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function EmployeeDetailPanel({ employee, onClose, onDeleted }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("profile");
  const [deleting, setDeleting] = useState(false);

  if (!employee) return null;
  const emp = employee;
  const name = emp.full_name || emp.users?.full_name || `Profile #${emp.id}`;

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${name}'s employee profile? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await hrService.deleteEmployee(emp.id);
      onDeleted();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete employee profile.");
    } finally {
      setDeleting(false);
    }
  };

  const assignmentsByClass = new Map<string, { sections: string[] }>();
  for (const a of emp.employee_class_section_assignments || []) {
    const key = a.classes ? `${a.classes.description} (${a.classes.class_code})` : `Class #${a.class_id}`;
    const sec = a.sections?.description || `Section #${a.section_id}`;
    if (!assignmentsByClass.has(key)) assignmentsByClass.set(key, { sections: [] });
    assignmentsByClass.get(key)!.sections.push(sec);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[85vh] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {emp.photo_url ? (
              <img
                src={emp.photo_url.replace(/([^:])\/\//g, "$1/")}
                alt={name}
                className="h-12 w-12 rounded-2xl object-cover bg-zinc-100 shrink-0"
              />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                {initials(name)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-[17px] font-black text-zinc-900 dark:text-zinc-100 tracking-tight truncate">{name}</h2>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
                {emp.employee_code || "No code"}
                {emp.designations?.title ? ` · ${emp.designations.title}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push(`/hr/employees/${emp.id}/edit`)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
            >
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-all disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-6 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-bold transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {tab === "profile" && (
              <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 divide-y divide-zinc-100 dark:divide-zinc-800">
                <Field icon={User} label="Father's Name" value={emp.father_name} missing={!emp.father_name} />
                <Field icon={User} label="Mother's Name" value={emp.mother_name} missing={!emp.mother_name} />
                <Field icon={CreditCard} label="CNIC" value={<span className="font-mono">{emp.cnic}</span>} missing={!emp.cnic} />
                <Field icon={Cake} label="Date of Birth" value={fmtDate(emp.date_of_birth)} missing={!fmtDate(emp.date_of_birth)} />
                <Field icon={Phone} label="Personal Phone" value={emp.personal_phone} missing={!emp.personal_phone} />
                <Field icon={Mail} label="Personal Email" value={emp.personal_email} missing={!emp.personal_email} />
                <Field icon={MapPin} label="Address" value={emp.address} missing={!emp.address} />
                {emp.notes && <Field icon={BookOpen} label="Internal Notes" value={emp.notes} />}
              </div>
            )}

            {tab === "employment" && (
              <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 divide-y divide-zinc-100 dark:divide-zinc-800">
                <Field icon={Briefcase} label="Designation" value={emp.designations?.title} missing={!emp.designations} />
                <Field icon={UsersIcon} label="Staff Type" value={emp.staff_types?.name} missing={!emp.staff_types} />
                <Field icon={Building2} label="Campus" value={emp.campuses?.campus_name} missing={!emp.campuses} />
                <Field icon={Briefcase} label="Job Title" value={emp.job_title} missing={!emp.job_title} />
                <Field icon={Calendar} label="Date of Joining" value={fmtDate(emp.join_date)} missing={!fmtDate(emp.join_date)} />
                <Field icon={Briefcase} label="Employment Type" value={emp.employment_type} missing={!emp.employment_type} />
                <Field
                  icon={UsersIcon}
                  label="Reporting Manager"
                  value={emp.reporting_manager?.full_name || emp.reporting_manager?.users?.full_name}
                  missing={!emp.reporting_manager}
                />
                {emp.job_description && <Field icon={BookOpen} label="Job Description" value={emp.job_description} />}
              </div>
            )}

            {tab === "schedule" && (
              <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 divide-y divide-zinc-100 dark:divide-zinc-800">
                <Field icon={Clock} label="Reporting Time" value={fmtTime(emp.reporting_time)} missing={!fmtTime(emp.reporting_time)} />
                <Field icon={Clock} label="Leaving Time" value={fmtTime(emp.leaving_time)} missing={!fmtTime(emp.leaving_time)} />
                <Field
                  icon={Clock}
                  label="Late Relaxation"
                  value={emp.late_relaxation_minutes != null ? `${emp.late_relaxation_minutes} minutes` : null}
                  missing={emp.late_relaxation_minutes == null}
                />
                <Field
                  icon={Calendar}
                  label="Working Days / Week"
                  value={emp.days_per_week}
                  missing={emp.days_per_week == null}
                />
                <Field icon={Briefcase} label="Monthly Pay" value={fmtMoney(emp.monthly_pay)} missing={emp.monthly_pay == null} />
              </div>
            )}

            {tab === "classes" && (
              <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                {assignmentsByClass.size === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-zinc-500">No class or section assignments</p>
                    <p className="text-xs text-zinc-400 mt-1">Assign classes from the Edit page.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...assignmentsByClass.entries()].map(([cls, { sections }]) => (
                      <div key={cls} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{cls}</span>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {sections.map(s => (
                            <span key={s} className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary">{s}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
