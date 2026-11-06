"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { ScopeMismatchReport } from "@/lib/hr.service";

interface MismatchReportProps {
  report: ScopeMismatchReport | null;
  loading: boolean;
  onRefresh: () => void;
  onSelectPerson: (id: number) => void;
}

export function MismatchReport({
  report,
  loading,
  onRefresh,
  onSelectPerson,
}: MismatchReportProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "managers" | "desks">("all");

  if (!report && !loading) return null;

  const total = report?.totalMismatches ?? 0;
  const managerMismatches = report?.managerReportMismatches ?? [];
  const deskMismatches = report?.deskMemberMismatches ?? [];

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden transition-all">
      {/* Header bar */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              total > 0
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
            }`}
          >
            {total > 0 ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Tree / Scope Mismatch Report
              </span>
              <span
                className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                  total > 0
                    ? "bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                    : "bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                }`}
              >
                {total > 0 ? `${total} issue${total === 1 ? "" : "s"} found` : "Aligned (0 issues)"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {total > 0
                ? "Flags managers who cannot view their reports, and desk members with unreached manager scopes."
                : "All reporting hierarchy lines and ticket desk member chains align with assigned scopes."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh mismatch report"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {total > 0 && (
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <span>{open ? "Hide Details" : "View Issues"}</span>
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details Panel */}
      {open && total > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-4">
          {/* Sub tabs */}
          <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === "all"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              All Issues ({total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("managers")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === "managers"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Manager ➔ Report Scope ({managerMismatches.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("desks")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === "desks"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Ticket Desk Chains ({deskMismatches.length})
            </button>
          </div>

          {/* List of Manager Mismatches */}
          {(activeTab === "all" || activeTab === "managers") && managerMismatches.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-500" />
                Manager ➔ Report Scope Divergences
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {managerMismatches.map((m, idx) => (
                  <div
                    key={`mgr-rep-${m.managerId}-${m.reportId}-${idx}`}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {m.managerName}{" "}
                          <span className="text-[10px] text-zinc-400 font-normal">
                            ({m.managerRole ?? "No Login"})
                          </span>{" "}
                          ➔ {m.reportName}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.mismatchedDimensions.map((dim) => (
                            <span
                              key={dim}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                            >
                              {dim} mismatch
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                      {m.reason}
                    </p>
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                      <button
                        type="button"
                        onClick={() => onSelectPerson(m.reportId)}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Locate {m.reportName}
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <button
                        type="button"
                        onClick={() => onSelectPerson(m.managerId)}
                        className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:underline cursor-pointer"
                      >
                        Locate {m.managerName}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List of Desk Member Mismatches */}
          {(activeTab === "all" || activeTab === "desks") && deskMismatches.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                Ticket Desk Member Chains
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {deskMismatches.map((d, idx) => (
                  <div
                    key={`desk-${d.queueId}-${d.memberUserId}-${idx}`}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-2 shadow-2xs"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {d.queueName} Desk ➔ {d.memberName}
                      </div>
                      {d.deskCampus && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                          Campus: {d.deskCampus.name}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                      {d.reason}
                    </p>
                    {d.memberEmployeeId && (
                      <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                        <button
                          type="button"
                          onClick={() => onSelectPerson(d.memberEmployeeId!)}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Locate {d.memberName} in Tree
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
