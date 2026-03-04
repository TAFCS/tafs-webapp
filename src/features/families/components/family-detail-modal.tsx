"use client";

import React, { useEffect, useState } from "react";
import { X, Users, UserCircle, GraduationCap, Phone, Mail, Building2 } from "lucide-react";
import {
  familiesService,
  type FamilyDetail,
  type FamilyStudent,
  type FamilyGuardian,
} from "@/lib/families.service";

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

export function FamilyDetailModal({ familyId, onClose }: FamilyDetailModalProps) {
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    familiesService
      .getById(familyId)
      .then(setFamily)
      .catch(() => setError("Failed to load family details."))
      .finally(() => setIsLoading(false));
  }, [familyId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-zinc-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-zinc-900 leading-tight">
                {family?.household_name ?? "Family Profile"}
              </h3>
              <p className="text-xs text-zinc-500">ID #{familyId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">
              Loading...
            </div>
          )}
          {error && (
            <div className="py-12 text-center text-red-500 text-sm">{error}</div>
          )}

          {family && !isLoading && (
            <>
              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoTile
                  label="Email"
                  value={family.email ?? "Not provided"}
                  icon={<Mail className="h-4 w-4" />}
                />
                <InfoTile
                  label="Username"
                  value={family.username ? `@${family.username}` : "Not set"}
                  icon={<UserCircle className="h-4 w-4" />}
                />
                <InfoTile
                  label="Publicity Consent"
                  value={family.consent_publicity ? "Granted" : "Not provided"}
                  icon={<Building2 className="h-4 w-4" />}
                  valueClass={family.consent_publicity ? "text-emerald-700" : "text-zinc-500"}
                />
                {family.primary_address && (
                  <InfoTile
                    label="Address"
                    value={family.primary_address}
                    icon={<Building2 className="h-4 w-4" />}
                    className="sm:col-span-2 lg:col-span-3"
                  />
                )}
              </div>

              {/* Students */}
              <section>
                <h4 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Enrolled Students ({family.students.length})
                </h4>
                {family.students.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">No students linked to this family.</p>
                ) : (
                  <div className="space-y-2">
                    {family.students.map((s: FamilyStudent) => (
                      <StudentRow key={s.id} student={s} />
                    ))}
                  </div>
                )}
              </section>

              {/* Guardians */}
              {family.guardians.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Guardians ({family.guardians.length})
                  </h4>
                  <div className="space-y-2">
                    {family.guardians.map((g: FamilyGuardian) => (
                      <GuardianRow key={g.id} guardian={g} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-zinc-50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-zinc-200 rounded-lg text-sm hover:bg-zinc-100 font-medium text-zinc-700 bg-white shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoTile({
  label,
  value,
  icon,
  className = "",
  valueClass = "text-zinc-800",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div className={`bg-zinc-50 border rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}

function StudentRow({ student }: { student: FamilyStudent }) {
  const statusStyle =
    STATUS_STYLES[student.status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-3">
        {student.photograph_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={student.photograph_url}
            alt={`${student.first_name} ${student.last_name}`}
            className="w-8 h-8 rounded-full object-cover border border-zinc-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
            {student.first_name.charAt(0)}
          </div>
        )}
        <div>
          <p className="font-medium text-zinc-800 text-sm">
            {student.first_name} {student.last_name}
          </p>
          <p className="text-xs text-zinc-400">
            {student.cc_number ?? "—"} · {student.campuses?.campus_name ?? "No campus"}
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

function GuardianRow({ guardian }: { guardian: FamilyGuardian }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center text-xs font-bold">
          {guardian.full_name.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-zinc-800 text-sm">{guardian.full_name}</p>
          <p className="text-xs text-zinc-400 capitalize">
            {guardian.relationship ?? "Guardian"}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-xs text-zinc-400">
        {guardian.primary_phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" /> {guardian.primary_phone}
          </span>
        )}
        {guardian.email_address && (
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" /> {guardian.email_address}
          </span>
        )}
      </div>
    </div>
  );
}
